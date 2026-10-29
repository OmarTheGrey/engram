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
// Forged tags (review round 2, defect 3): every other message the model is
// sent (a file read, any other tool's result, a user message, an assistant
// message, a bash execution, another extension's custom message, a summary)
// has every tag opener defused: `<`, or a lookalike of it, followed by
// `engram` (after optional spaces, invisible characters and a `/`) becomes
// `&lt;`. So the only `<engram:` markup the model sees is what this handler
// rebuilt from its record. A per-session secret nonce in the tag was the
// other option; it was not taken because it protects nothing unless the
// model checks the nonce, and the model is what the forgery targets, whereas
// defusing does not depend on the model or on any text the attacker
// controls. Thinking blocks are left as they are (providers sign them), as
// are details, which pi never sends to the model.
//
// The session's messages carry no memory text (review round 2, defect 5): a
// read's tool result and a recall message are stored with a placeholder
// naming the read as their content, and the governed text lives only in the
// record and in the details, which pi never sends to a model. So a
// path that sends the session's messages to a model without the `context`
// event (pi's bug-report summary, compaction, branch summaries) never sends
// memory text, and the model still gets the tagged items through `context`.
//
// What this does not cover: a `context` or later handler of another
// extension that runs after this one can still change what is sent; an
// extension is code in the same process and can reach the store itself, or
// write memory text into the session's messages itself (for example by
// rewriting a result in its tool_result handler). The system prompt is not
// among the messages and is not defused. A lookalike of `engram` spelled with
// another alphabet's letters is not defused.
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

/**
 * What the session stores for a read, in place of the items' text (review
 * round 2, defect 5). The model never sees it while the extension runs: the
 * context handler replaces it with the tagged items.
 */
export function sessionPlaceholder(details: RecallDetails): string {
  const n = details.items.length;
  return `memory read ${details.read_id}: ${n} item${n === 1 ? "" : "s"} admitted, ${details.filtered} filtered; the Engram extension shows them to the model and keeps their text out of the session`;
}

/** A tag opener: `<` or a lookalike, optional spaces or invisible characters, an optional `/`, then `engram`. */
const TAG_OPENER =
  /[<\uff1c\ufe64\u2039\u3008\u27e8\u2329]([\s\u00ad\u200b-\u200f\u2060\ufeff]*\/?[\s\u00ad\u200b-\u200f\u2060\ufeff]*)(engram)/gi;

/** `text` with every tag opener defused, so it can never read as Engram markup. */
export const neutraliseTags = (text: string) => text.replace(TAG_OPENER, "&lt;$1$2");

/** Thinking blocks are signed by the provider and are left as they are. */
const SIGNED = new Set(["thinking", "redactedThinking", "redacted_thinking"]);

/** `value` with every string defused; the same reference when nothing changed. */
function defuse(value: unknown): unknown {
  if (typeof value === "string") return neutraliseTags(value);
  if (Array.isArray(value)) {
    const out = value.map(defuse);
    return out.some((v, i) => v !== value[i]) ? out : value;
  }
  if (value && typeof value === "object") {
    if (SIGNED.has(String((value as { type?: unknown }).type))) return value;
    const entries = Object.entries(value);
    const out = entries.map(([k, v]) => [k, defuse(v)] as const);
    return out.some(([, v], i) => v !== entries[i]?.[1]) ? Object.fromEntries(out) : value;
  }
  return value;
}

/** A message, or a session entry, with every tag opener outside its details defused. */
export function defuseMessage<M extends object>(m: M): M {
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m)) {
    const d = k === "details" ? v : defuse(v);
    if (d !== v) changed = true;
    out[k] = d;
  }
  return changed ? (out as M) : m;
}

/** Escapes text so it is never markup: `&` first, then the angle brackets and quotes. */
const escapeMarkup = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** One item as the memory tag shows it. `policy_id`, the admitting rule, is C5's only. */
interface TaggedItem {
  item_id: string;
  scope: string;
  rank: number;
  content: string;
  policy_id?: string;
}

/** A read as the memory tag shows it. The read id and the read rule are C5's only. */
interface TaggedRead {
  read_id?: string;
  policy_id?: string;
  filtered: number;
  items: readonly TaggedItem[];
}

/** ` name="value"`, escaped, or nothing when there is no value. */
const attr = (name: string, value: string | undefined) =>
  value === undefined ? "" : ` ${name}="${escapeMarkup(value)}"`;

/**
 * The memory tag, one shape in every condition (ADR 0015, amended in PR 6):
 * the read's `filtered` count, and per item its id, scope, rank and escaped
 * content. A governed read adds the read id and the rules that admitted it;
 * those attributes are the only difference the conditions show the model.
 * Scores stay in the explanations (details, `memory_explain`), not the tag.
 */
function tagRead(read: TaggedRead): string {
  const head = `<engram:memory${attr("read_id", read.read_id)}${attr("policy_id", read.policy_id)} filtered="${read.filtered}">`;
  const body = read.items.map(
    (i) =>
      `<engram:item${attr("item_id", i.item_id)}${attr("scope", i.scope)} rank="${i.rank}"${attr("policy_id", i.policy_id)}>\n${escapeMarkup(i.content)}\n</engram:item>`,
  );
  return [head, ...(body.length > 0 ? body : ["no memories"]), "</engram:memory>"].join("\n");
}

/** The tagged text the model receives for a governed read (C5). */
export const tagRecall = (details: RecallDetails): string => tagRead(details);

/**
 * The tagged text the model receives for an ungoverned read (C2, C3): the
 * store's matches in its order, nothing filtered, no read id and no rules.
 */
export function tagUngovernedRead(
  items: readonly { id: string; scope: string; content: string }[],
): string {
  return tagRead({
    filtered: 0,
    items: items.map((i, n) => ({
      item_id: i.id,
      scope: i.scope,
      rank: n + 1,
      content: i.content,
    })),
  });
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
      // A recorded text (a write result, a refusal, an explanation) may quote
      // what the model or a store supplied, so it is defused like the rest.
      const textOut = match.recall ? tagRecall(match.recall) : neutraliseTags(match.text as string);
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
    return defuseMessage(m);
  });
  return { messages: out, withheld };
}

/**
 * The messages a summary is made from, with every memory result and recall
 * message replaced by a notice (finding R7-15). Pi's compaction and branch
 * summaries send session messages to the model without the `context` event,
 * so memory is kept out of them altogether rather than tagged, and every
 * other message has its tag openers defused.
 */
export function withoutMemory<M extends AgentMessage>(messages: readonly M[]): M[] {
  return messages.map((m) => {
    if (m.role === "toolResult" && isMemoryTool(m.toolName))
      return { ...m, content: [{ type: "text", text: SUMMARY_NOTICE }], details: {} };
    if (m.role === "custom" && m.customType === RECALL_MESSAGE)
      return { ...m, content: SUMMARY_NOTICE, details: {} };
    return defuseMessage(m);
  });
}
