// Read path (ADR 0009, docs/architecture.md "Read path", decision D11): what
// reaches the model through a memory tool is only what this extension
// produced in this process, as it recorded it. The extension records every
// result it produces (keyed by tool call id: the actor, and for a read the
// read id and the admitted items) and every recall message it injects (keyed
// by read id). The `context` handler rebuilds a recorded result from the
// record, tagging a read with its read id and, per item, the rule that
// admitted it, and withholds every other result under a memory_* tool name:
// one whose call the extension never ran (another extension's tool of the
// same name, a call pi rejected or another handler blocked), one whose
// details, text or error flag differ from the record (another extension's
// tool_result handler rewrote it), one recorded for another actor, and every
// result of an earlier process (a resumed session). Item content is escaped,
// so stored text cannot open or close a tag or forge an attribute.
//
// What this does not cover: a `context` or later handler of another
// extension that runs after this one can still change what is sent; an
// extension is code in the same process and can reach the store itself.
import type { Explanation, MemoryItem } from "@engram/core";
import type { AgentMessage } from "./vendor/pi-types.ts";

/** Tool names whose results are memory: every memory_* name, registered by this extension or not. */
export const isMemoryTool = (toolName: string) => toolName.startsWith("memory_");
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

/** Escapes text so it is never markup: `&` first, then the angle brackets and quotes. */
const escapeMarkup = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** The tagged text the model receives. */
export function tagRecall(details: RecallDetails): string {
  const head = `<engram:memory read_id="${escapeMarkup(details.read_id)}" policy_id="${escapeMarkup(details.policy_id)}" filtered="${details.filtered}">`;
  const body = details.items.map(
    (i) =>
      `<engram:item item_id="${escapeMarkup(i.item_id)}" scope="${escapeMarkup(i.scope)}" rank="${i.rank}" score="${i.score.toFixed(3)}" policy_id="${escapeMarkup(i.policy_id)}">\n${escapeMarkup(i.content)}\n</engram:item>`,
  );
  return [head, ...(body.length > 0 ? body : ["no memories"]), "</engram:memory>"].join("\n");
}

/** What the model sees in place of a memory result the extension did not produce. */
export const WITHHELD =
  "<engram:memory withheld>this memory tool result was not produced by the Engram plane for this session (another extension's tool, a call that did not run, or a changed result), so it is not shown; call memory_read again</engram:memory>";

/** What a summary sees in place of memory (compaction, branch summaries). */
export const SUMMARY_NOTICE =
  "<engram:memory omitted>governed memory is not carried into summaries; call memory_read again</engram:memory>";

/** One result the extension produced, as it recorded it. */
interface Produced {
  toolName: string;
  actor: string;
  isError: boolean;
  /** A read's details; the model is shown them tagged. */
  recall?: RecallDetails;
  /** Any other result's text, shown as it is. */
  text?: string;
}

/**
 * Every result this extension produced in this process, and every recall it
 * injected. In memory only: a resumed session's earlier results are not here,
 * so they are withheld, and the model reads again.
 */
export class ProducedResults {
  private readonly calls = new Map<string, Produced[]>();
  private readonly recalls = new Map<string, Produced>();

  private add(toolCallId: string, produced: Produced): void {
    const list = this.calls.get(toolCallId) ?? [];
    list.push(produced);
    this.calls.set(toolCallId, list);
  }

  addRead(toolCallId: string, actor: string, recall: RecallDetails): void {
    this.add(toolCallId, { toolName: "memory_read", actor, isError: false, recall });
  }

  addText(toolCallId: string, toolName: string, actor: string, text: string, isError: boolean) {
    this.add(toolCallId, { toolName, actor, isError, text });
  }

  addRecall(actor: string, recall: RecallDetails): void {
    this.recalls.set(recall.read_id, { toolName: RECALL_MESSAGE, actor, isError: false, recall });
  }

  forCall(toolCallId: string): readonly Produced[] {
    return this.calls.get(toolCallId) ?? [];
  }

  forRecall(readId: string): Produced | undefined {
    return this.recalls.get(readId);
  }
}

/** A message's text: a string, or its text blocks joined. */
function messageText(content: unknown): string | undefined {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;
  const parts = content.map((c) =>
    c && typeof c === "object" && (c as { type?: unknown }).type === "text"
      ? String((c as { text?: unknown }).text)
      : null,
  );
  return parts.includes(null) ? undefined : parts.join("");
}

/** The read's details equal the recorded ones: same read id, rule, count and items. */
function sameRecall(recorded: RecallDetails, details: unknown): boolean {
  if (!details || typeof details !== "object") return false;
  const d = details as Partial<RecallDetails>;
  return (
    d.read_id === recorded.read_id &&
    d.policy_id === recorded.policy_id &&
    d.filtered === recorded.filtered &&
    JSON.stringify(d.items) === JSON.stringify(recorded.items)
  );
}

/** A memory result withheld from the model, for its one deny event. */
export interface Withheld {
  /** Logged once per key. */
  key: string;
  toolName: string;
  toolCallId: string | null;
}

/**
 * Rebuilds every memory result the extension produced, for `actor`, from its
 * record, and withholds every other memory result and recall message.
 */
export function tagMemoryResults(
  messages: readonly AgentMessage[],
  record: ProducedResults,
  actor: string,
): { messages: AgentMessage[]; withheld: Withheld[] } {
  const withheld: Withheld[] = [];
  const out = messages.map((m): AgentMessage => {
    if (m.role === "toolResult" && isMemoryTool(m.toolName)) {
      const shown = messageText(m.content);
      const match = record
        .forCall(m.toolCallId)
        .find(
          (p) =>
            p.toolName === m.toolName &&
            p.actor === actor &&
            p.isError === m.isError &&
            (p.recall ? sameRecall(p.recall, m.details) : shown === p.text),
        );
      if (!match) {
        withheld.push({
          key: `call:${m.toolCallId}`,
          toolName: m.toolName,
          toolCallId: m.toolCallId,
        });
        return { ...m, content: [{ type: "text", text: WITHHELD }], details: {} };
      }
      const textOut = match.recall ? tagRecall(match.recall) : (match.text as string);
      return { ...m, content: [{ type: "text", text: textOut }] };
    }
    if (m.role === "custom" && m.customType === RECALL_MESSAGE) {
      const readId = (m.details as { read_id?: unknown } | undefined)?.read_id;
      const p = typeof readId === "string" ? record.forRecall(readId) : undefined;
      if (!p?.recall || p.actor !== actor || !sameRecall(p.recall, m.details)) {
        withheld.push({
          key: `recall:${String(readId)}`,
          toolName: RECALL_MESSAGE,
          toolCallId: null,
        });
        return { ...m, content: WITHHELD, details: {} };
      }
      return { ...m, content: tagRecall(p.recall) };
    }
    return m;
  });
  return { messages: out, withheld };
}

/**
 * The messages a summary is made from, with every memory result and recall
 * message replaced by a notice (finding R7-15). Pi's compaction and branch
 * summaries send session messages to the model without the `context` event,
 * so memory is kept out of them altogether rather than tagged.
 */
export function withoutMemory<M extends AgentMessage>(messages: readonly M[]): M[] {
  return messages.map((m) => {
    if (m.role === "toolResult" && isMemoryTool(m.toolName))
      return { ...m, content: [{ type: "text", text: SUMMARY_NOTICE }], details: {} };
    if (m.role === "custom" && m.customType === RECALL_MESSAGE)
      return { ...m, content: SUMMARY_NOTICE, details: {} };
    return m;
  });
}
