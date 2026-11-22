// The memory tag (ADR 0015, amended in PR 6; ADR 0009 decision D11): the
// one shape governed memory has in front of a model on every path (the pi
// extension, the MCP server, the framework kit and its adapters), and the
// defusing of tag openers in every other text. Pure functions with no pi
// import, split out of packages/pi-extension/src/tag.ts by card E8.14's
// review fix pass (finding E8.14-4, the lead's decision; ADR 0033), so a
// framework adapter shows the same tag without installing pi. The pi
// extension's context handler, which rebuilds recorded results and withholds
// the rest, stays in packages/pi-extension/src/tag.ts.
import type { Explanation, MemoryItem } from "@engram/core";

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

/**
 * A tag opener: `<`, a lookalike of it or its numeric character reference
 * (`&#60;`, `&#x3c;`, review finding E8.14-7), optional spaces or invisible
 * characters, an optional `/`, then `engram`.
 */
const TAG_OPENER =
  /(?:[<\uff1c\ufe64\u2039\u3008\u27e8\u2329]|&#0*60;|&#x0*3c;)([\s\u00ad\u200b-\u200f\u2060\ufeff]*\/?[\s\u00ad\u200b-\u200f\u2060\ufeff]*)(engram)/gi;

/** `text` with every tag opener defused, so it can never read as Engram markup. */
export const neutraliseTags = (text: string) => text.replace(TAG_OPENER, "&lt;$1$2");

/** Escapes text so it is never markup: `&` first, then the angle brackets and quotes. */
const escapeMarkup = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * One item as the memory tag shows it. `policy_id`, the admitting rule, is
 * C5's only; `attributes`, the item's metadata, is C4's only (ADR 0031).
 */
interface TaggedItem {
  item_id: string;
  scope: string;
  rank: number;
  content: string;
  policy_id?: string;
  attributes?: readonly (readonly [string, string])[];
}

/** The attributes the tag itself writes; metadata may not reuse one. */
const OWN_ATTRIBUTES = new Set(["item_id", "scope", "rank", "policy_id", "read_id", "filtered"]);
const ATTRIBUTE_NAME = /^[a-z][a-z_]*$/;

/** An item's metadata as attributes, each name a plain lower-case word the tag does not own. */
function metadata(attributes: TaggedItem["attributes"]): string {
  return (attributes ?? [])
    .map(([name, value]) => {
      if (!ATTRIBUTE_NAME.test(name) || OWN_ATTRIBUTES.has(name)) {
        throw new Error(`memory tag: ${JSON.stringify(name)} is not a metadata attribute name`);
      }
      return attr(name, value);
    })
    .join("");
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
 * Scores stay in the explanations (details, the log, `engram explain`, and
 * `memory_explain` where it is offered), not the tag.
 */
function tagRead(read: TaggedRead): string {
  const head = `<engram:memory${attr("read_id", read.read_id)}${attr("policy_id", read.policy_id)} filtered="${read.filtered}">`;
  const body = read.items.map(
    (i) =>
      `<engram:item${attr("item_id", i.item_id)}${attr("scope", i.scope)} rank="${i.rank}"${metadata(i.attributes)}${attr("policy_id", i.policy_id)}>\n${escapeMarkup(i.content)}\n</engram:item>`,
  );
  return [head, ...(body.length > 0 ? body : ["no memories"]), "</engram:memory>"].join("\n");
}

/** The tagged text the model receives for a governed read (C5). */
export const tagRecall = (details: RecallDetails): string => tagRead(details);

/**
 * The tagged text the model receives for an ungoverned read (C2, C3, C4):
 * the store's matches in its order, nothing filtered, no read id and no
 * rules. C4's items carry their metadata as attributes after the rank
 * (ADR 0031); without them the tag is C2's and C3's.
 */
export function tagUngovernedRead(
  items: readonly {
    id: string;
    scope: string;
    content: string;
    attributes?: readonly (readonly [string, string])[];
  }[],
): string {
  return tagRead({
    filtered: 0,
    items: items.map((i, n) => ({
      item_id: i.id,
      scope: i.scope,
      rank: n + 1,
      content: i.content,
      ...(i.attributes === undefined ? {} : { attributes: i.attributes }),
    })),
  });
}

/** What the model sees in place of a memory result the extension did not produce. */
export const WITHHELD =
  "<engram:memory withheld>this memory tool result was not produced by the Engram plane for this session (another extension's tool, a call that did not run, or a changed result), so it is not shown; call memory_read again</engram:memory>";
