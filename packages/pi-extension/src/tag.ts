// Read path (ADR 0001, docs/architecture.md "Read path"): memory that reaches
// the model is what Plane.read admitted, marked as governed memory with the
// read id and, per item, the rule that admitted it. Runs in the `context`
// handler, so the tag exists only in the request; the session keeps the plain
// result. The text the model sees is rebuilt from the recall details the
// extension recorded from the Plane's ReadResult, never from the result's own
// text, so nothing the Plane did not admit reaches the model through a memory
// result, even if another extension rewrote that text.
import type { Explanation, MemoryItem } from "@engram/core";
import type { AgentMessage } from "./vendor/pi-types.ts";

/** Tool results whose content is governed memory. */
export const MEMORY_TOOLS: readonly string[] = ["memory_read"];
/** customType of the recall message before_agent_start injects. */
export const RECALL_MESSAGE = "engram.recall";

/** One item a read admitted, as the model is shown it. */
export interface RecalledItem {
  item_id: string;
  scope: string;
  content: string;
  rank: number;
  score: number;
  /** The rule that admitted the item, from its explanation. */
  policy_id: string;
}

/** What a memory result carries in its details: the read and what it admitted. */
export interface RecallDetails {
  read_id: string;
  /** The read event's rule. */
  policy_id: string;
  filtered: number;
  items: RecalledItem[];
  explanations: Explanation[];
}

const text = (item: MemoryItem) =>
  typeof item.content === "string" ? item.content : JSON.stringify(item.content);

/** The recall details of a ReadResult: items paired with their explanations, in rank order. */
export function recallDetails(
  readId: string,
  policyId: string,
  filtered: number,
  items: readonly MemoryItem[],
  explanations: readonly Explanation[],
): RecallDetails {
  const byId = new Map(items.map((i) => [i.id, i]));
  const recalled = explanations.flatMap((e) => {
    const item = byId.get(e.item_id);
    if (!item) return [];
    return [
      {
        item_id: item.id,
        scope: item.scope,
        content: text(item),
        rank: e.rank,
        score: e.score.total,
        policy_id: e.policy_id,
      },
    ];
  });
  return {
    read_id: readId,
    policy_id: policyId,
    filtered,
    items: recalled,
    explanations: [...explanations],
  };
}

/** The plain text stored in the session: one `scope: content` line per item. */
export function renderRecall(details: RecallDetails): string {
  return details.items.map((i) => `${i.scope}: ${i.content}`).join("\n") || "no memories";
}

const attr = (s: string) => s.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

/** The tagged text the model receives. */
export function tagRecall(details: RecallDetails): string {
  const head = `<engram:memory read_id="${attr(details.read_id)}" policy_id="${attr(details.policy_id)}" filtered="${details.filtered}">`;
  const body = details.items.map(
    (i) =>
      `<engram:item item_id="${attr(i.item_id)}" scope="${attr(i.scope)}" rank="${i.rank}" score="${i.score.toFixed(3)}" policy_id="${attr(i.policy_id)}">\n${i.content}\n</engram:item>`,
  );
  return [head, ...(body.length > 0 ? body : ["no memories"]), "</engram:memory>"].join("\n");
}

export function isRecallDetails(details: unknown): details is RecallDetails {
  if (!details || typeof details !== "object") return false;
  const d = details as Record<string, unknown>;
  return typeof d.read_id === "string" && typeof d.policy_id === "string" && Array.isArray(d.items);
}

/** A memory result without recall details carries nothing the Plane admitted. */
export const WITHHELD = "<engram:memory withheld>no plane read backs this result</engram:memory>";

const tagged = (details: unknown) => (isRecallDetails(details) ? tagRecall(details) : WITHHELD);

/**
 * Replaces the text of every successful memory tool result and every recall
 * message with the tagged recall its details record. Error results pass
 * unchanged: they carry a refusal, not memory.
 */
export function tagMemoryResults(messages: readonly AgentMessage[]): AgentMessage[] {
  return messages.map((m) => {
    if (m.role === "toolResult" && MEMORY_TOOLS.includes(m.toolName) && !m.isError) {
      return { ...m, content: [{ type: "text", text: tagged(m.details) }] };
    }
    if (m.role === "custom" && m.customType === RECALL_MESSAGE) {
      return { ...m, content: tagged(m.details) };
    }
    return m;
  });
}
