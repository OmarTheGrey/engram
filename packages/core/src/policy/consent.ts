// Consent at the write gate (card E9.12 of the second absorb plan): a person
// declares opt-outs for their person scope, and no allowed write records
// content an active opt-out covers. Pure and deterministic, like the other
// evaluators: no clock (the window is judged at the time the caller passes),
// no store, no model. Off unless the policy has a `consent` block; absent in
// every registered preset and bundled profile, so today's behaviour.
//
// An opt-out (schema.ts `OptOut`) names a person scope and narrows by each
// field it sets: a topic, a provenance source, a window (`since` inclusive,
// `until` exclusive). One that sets none covers every write to the scope;
// one with only a window is Incognito. `except_topics` are its carve-outs: a
// write whose content names one is not covered by that opt-out.
//
// Which writes it judges (the decision entry
// docs/log/2026-11-28-e9-12-decision-which-writes.md): a write that records
// content into the scope or makes covered content live. That is a first
// write, whatever its status (a write landing retired still puts its content
// in the log and the store); a rewrite moving an item into the scope; a
// rewrite whose content differs from the projected item's (core's normal
// form, content-hash.ts), a retire carrying new content included; and a
// rewrite that makes the same content more live than it was: retired to
// candidate or active, or candidate to active (an un-retire, a promotion in
// place, an owner's acceptance). Only a rewrite in the same scope that keeps
// the content and makes it no more live passes unjudged: a plain retire, a
// close, a grant change, a confidence change. So a person can always retire
// what was recorded before they opted out, and nothing an opt-out covers is
// brought back to life while it is active.
//
// What it is not: a gate on writes, judged at the write's time. Content
// produced during an Incognito window and written after it (a store record
// adopted later, a session distilled or consolidated later) is judged at the
// later time; the pi session tree, the episodic record, is not under the gate
// at all. Consent is a control a cooperative writer meets, the person's own
// agent and tools, not a filter an adversarial writer cannot evade (see the
// matching limits below).
//
// How a topic matches (the decision entry
// docs/log/2026-11-28-e9-12-decision-topic-matches-words.md): items carry no
// topic field (finding docs/log/2026-11-28-e2-14-finding-consent-gaps-for-e9-12.md),
// so a topic is matched against the content's words: text NFKC-normalised,
// stripped of code points that render as nothing, and lower-cased, cut into words of letters, marks and digits, and the
// topic's words must appear consecutively within one string of the content
// (the text, or a key or string value of a record, or a procedure's body or
// one of its tools). Whole words only, no stemming: "health" matches "Health
// insurance" and "my health." but not "healthy". The rule is one a person
// can predict, and the reason names it. Its known evasions, stated and not
// closed: plurals and inflections ("bank accounts" escapes "bank account");
// a combining accent inside a word ("he\u0301alth" keeps its mark); joined
// compounds and camelCase ("healthcare", "bankAccount"); a digit glued to a
// word ("health2"); letters split by spaces or punctuation ("h.e.a.l.t.h");
// homoglyphs NFKC does not fold (Cyrillic U+0435 for "e"); a topic split across two
// writes; and toLowerCase is not full case folding ("STRASSE" is not
// "strasse" with a sharp s, U+00DF).
//
// The refusal (`engram/write/consent`) names the opt-out by its index and its
// fields, never the content: what a person asked not to be recorded is not
// repeated in the reason, and the denied event carries no item (plane/write.ts).
//
// Ported (ADR 0037, mode port; docs/absorbed.md): EverOS's `do_not_record`
// (`src/everos/memory/models.py`, Apache-2.0, EverMind-AI/EverOS at
// e594efe59cc6), a list of matters the owner asked not to be recorded, each a
// topic with the time it was declared, kept with the owner and consulted
// before anything is recorded. EverOS leaves the matching to its extractor
// model; here it is a deterministic rule, and carve-outs and a source and a
// window are added.
import { contentHash } from "../content-hash.ts";
import type { Consent, MemoryItem, Policy } from "../schema.ts";
import { compareTimestamps } from "../time.ts";

/** One opt-out, as the schema's `OptOut` admits it. */
export type OptOut = Consent["opt_outs"][number];

/** The rule of a write an opt-out refuses. */
export const CONSENT_ID = "engram/write/consent";

/** A run of letters, combining marks and digits: one word. */
const WORD = /[\p{L}\p{M}\p{N}]+/gu;

/**
 * Code points that render as nothing (content-hash.ts reads them the same
 * way): removed before words are cut, so a zero-width joiner inside a word
 * does not hide it from a topic. The property covers the Hangul fillers
 * U+3164 and U+115F, which content-hash.ts also lists by name.
 */
const INVISIBLE = /\p{Default_Ignorable_Code_Point}/gu;

/** The words of `s`, NFKC-normalised without invisible code points and lower-cased, in order. */
export function words(s: string): string[] {
  return (
    s.normalize("NFKC").replace(INVISIBLE, "").normalize("NFKC").toLowerCase().match(WORD) ?? []
  );
}

/** Every string the content holds, each matched on its own: text, keys and values, a body and its tools. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (typeof value === "number" || typeof value === "boolean") out.push(String(value));
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value !== null && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      strings(v, out);
    }
  return out;
}

/** Do the words of `topic` appear consecutively in one string of `content`? A topic with no words matches nothing. */
export function namesTopic(content: MemoryItem["content"], topic: string): boolean {
  const want = words(topic);
  if (want.length === 0) return false;
  return strings(content).some((s) => {
    const have = words(s);
    for (let i = 0; i + want.length <= have.length; i++)
      if (want.every((w, j) => have[i + j] === w)) return true;
    return false;
  });
}

/**
 * Is `at` inside the opt-out's window: since <= at < until, either end open
 * when absent. With no time, every window counts as open: the side that
 * records nothing (every write path passes one; see consentRefusal).
 */
export function inWindow(o: OptOut, at: string | undefined): boolean {
  if (at === undefined) return true;
  return (
    (o.since === undefined || compareTimestamps(o.since, at) <= 0) &&
    (o.until === undefined || compareTimestamps(o.until, at) > 0)
  );
}

/** Does the opt-out cover `item`, written at `at`: every field it sets matches, and no carve-out does. */
export function covers(o: OptOut, item: MemoryItem, at: string | undefined): boolean {
  if (o.scope !== item.scope) return false;
  if (o.source !== undefined && o.source !== item.provenance.kind) return false;
  if (!inWindow(o, at)) return false;
  if (o.topic !== undefined && !namesTopic(item.content, o.topic)) return false;
  return !(o.except_topics ?? []).some((t) => namesTopic(item.content, t));
}

/** How live a status is: a retired item is read by no one, a candidate waits for review, an active item is read. */
const LIVENESS: Record<MemoryItem["status"], number> = { retired: 0, candidate: 1, active: 2 };

/**
 * Does the write record content into the item's scope, or make it live: a
 * first write (any status), a move into the scope, new content, or the same
 * content made more live than the projected item (an un-retire, candidate to
 * active)? False only for a same-scope, same-content rewrite that makes it no
 * more live.
 */
export function recordsContent(item: MemoryItem, existing: MemoryItem | undefined): boolean {
  if (existing === undefined || existing.scope !== item.scope) return true;
  if (contentHash(item.content) !== contentHash(existing.content)) return true;
  return LIVENESS[item.status] > LIVENESS[existing.status];
}

/** The opt-out as a reason names it: its fields, never the content. */
export function optOutText(o: OptOut): string {
  const parts = [
    ...(o.topic !== undefined ? [`topic "${o.topic}"`] : []),
    ...(o.source !== undefined ? [`source ${o.source}`] : []),
    ...(o.since !== undefined || o.until !== undefined
      ? [`window [${o.since ?? "open"}, ${o.until ?? "open"})`]
      : []),
    ...((o.except_topics ?? []).length > 0
      ? [`except topics ${(o.except_topics ?? []).map((t) => `"${t}"`).join(", ")}`]
      : []),
  ];
  return parts.length === 0 ? "every write" : parts.join(", ");
}

/** The first opt-out that covers the write, with its index, or null; null when the policy has no consent block. */
export function coveringOptOut(
  policy: Policy,
  item: MemoryItem,
  existing: MemoryItem | undefined,
  at: string | undefined,
): { index: number; optOut: OptOut } | null {
  const optOuts = policy.consent?.opt_outs ?? [];
  if (optOuts.length === 0 || !recordsContent(item, existing)) return null;
  const index = optOuts.findIndex((o) => covers(o, item, at));
  return index === -1 ? null : { index, optOut: optOuts[index] as OptOut };
}

/**
 * Why an opt-out refuses the write, or null. `at` is the write's time, at
 * which the windows are judged: the plane's write and adoption paths pass
 * the event's time, and the promotion gate its own (policy/promotion.ts).
 */
export function consentRefusal(
  policy: Policy,
  item: MemoryItem,
  existing: MemoryItem | undefined,
  at: string | undefined,
): string | null {
  const hit = coveringOptOut(policy, item, existing, at);
  if (hit === null) return null;
  return `consent.opt_outs[${hit.index}] of policy ${policy.id} (${optOutText(hit.optOut)}) covers this write to ${item.scope}: the person opted out of recording it, so nothing was stored`;
}

/** Do the words `part` occur consecutively in `whole`? */
function within(part: readonly string[], whole: readonly string[]): boolean {
  for (let i = 0; i + part.length <= whole.length; i++)
    if (part.every((w, j) => whole[i + j] === w)) return true;
  return false;
}

/**
 * What the loader reports in a consent block (policy/load.ts): an opt-out
 * that could never cover a write, which is a mistake to report rather than a
 * rule to apply. A topic or carve-out with no word matches nothing; a window
 * whose end is not after its start holds no instant; a carve-out whose words
 * are the topic's, or a consecutive part of them, removes every write the
 * topic covers.
 */
export function consentProblems(policy: Policy): { path: (string | number)[]; message: string }[] {
  const out: { path: (string | number)[]; message: string }[] = [];
  (policy.consent?.opt_outs ?? []).forEach((o, i) => {
    const at = ["consent", "opt_outs", i];
    if (o.topic !== undefined && words(o.topic).length === 0)
      out.push({
        path: [...at, "topic"],
        message: `topic "${o.topic}" has no word (letters or digits), so it would match no write`,
      });
    (o.except_topics ?? []).forEach((t, j) => {
      if (words(t).length === 0)
        out.push({
          path: [...at, "except_topics", j],
          message: `except topic "${t}" has no word (letters or digits), so it would carve out nothing`,
        });
      else if (o.topic !== undefined && within(words(t), words(o.topic)))
        out.push({
          path: [...at, "except_topics", j],
          message:
            words(t).join(" ") === words(o.topic).join(" ")
              ? `except topic "${t}" is the opt-out's own topic, so the opt-out would cover no write`
              : `except topic "${t}" is part of the topic "${o.topic}", so every write the topic covers is carved out and the opt-out would cover no write`,
        });
    });
    if (o.since !== undefined && o.until !== undefined && compareTimestamps(o.until, o.since) <= 0)
      out.push({
        path: [...at, "until"],
        message: `until ${o.until} is not after since ${o.since}, so the window holds no instant`,
      });
  });
  return out;
}
