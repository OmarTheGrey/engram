// The invariant oracles: what a policy permits, written independently of any
// Plane and of the evaluator (no import from src/policy). Part of the
// lead-owned invariants file (docs/conventions/testing.md): changes need a
// second reviewer and a `decision` log entry. They encode ADR 0006 as amended,
// and decision D4 of the review fix pass for who may write; one commitment
// awaits the lead's confirmation: an item in `org` scope is readable through
// scope only by an actor whose memberships include "org".
//
// The formulations differ from the evaluator's on purpose (finding R5-11): a
// pattern is matched by comparing the actor id's leading characters, not by
// startsWith, and grants are judged by enumerating what is allowed. Both sides
// compare timestamps through core's one helper (decision D7), which has its
// own tests at nanosecond boundaries (test/unit/time.test.ts).
//
// Retention (card E2.4, ADR 0025) adds three readings: an item past its ttl
// is not readable (`pastTtl`, judged as a duration rather than by adding the
// ttl as the evaluator does), a model, compaction or tool write may not
// restate content an event retired in its scope (compared by the oracle's own
// normal form, `sameContent`, not core's hash: finding P4-9), and which items
// a budget overage evicts (`budgetVictims`).
//
// Promotion (card E2.5, ADR 0026) adds `promotionPermitted`: reach, expiry,
// the source of a widening, duplicates, reviewers (authors included) and the
// evidence a landing promotion needs, all judged from the oracle's own
// replay of the events with its own strict content reading
// (`sameStrictContent`); the landed item is judged by `writeForbidden` like
// any write.
import type { Actor } from "../../src/plane.ts";
import type { Grant, MemoryEvent, MemoryItem, Policy } from "../../src/schema.ts";
import { compareTimestamps } from "../../src/time.ts";

const level = (scope: string) => (scope === "org" ? "org" : scope.split(":")[0]);

/** Exact principal, or a trailing `*` standing for any rest of the id. */
export function patternCovers(pattern: string, actorId: string): boolean {
  const star = pattern.indexOf("*");
  if (star === -1) return pattern === actorId;
  const head = pattern.slice(0, star);
  return actorId.length >= head.length && actorId.slice(0, head.length) === head;
}

const wholeSeconds = (ts: string) => Date.parse(`${ts.slice(0, 19)}Z`) / 1000;
const fractionOf = (ts: string) => /\.(\d+)Z$/.exec(ts)?.[1] ?? "";

/**
 * Is `item` past its ttl at `at` (ADR 0025)? The ttl is the smaller of the
 * item's own and its retention rule's (level and class); none means never.
 * Judged as a duration, not by adding: `at` minus `valid_from` is at least
 * the ttl. Whole seconds decide unless they tie with the ttl, and then the
 * fractions do, compared digit by digit.
 */
export function pastTtl(policy: Policy, item: MemoryItem, at: string): boolean {
  // Hand-built policies and items in the oracle's own tests may leave these out.
  const rule = (policy.retention ?? []).filter(
    (r) => r.scope === level(item.scope) && r.class === item.class,
  )[0];
  const ttls = [item.ttl ?? null, rule ? rule.ttl : null].filter((t): t is number => t !== null);
  if (ttls.length === 0) return false;
  const gap = wholeSeconds(at) - wholeSeconds(item.valid_from) - Math.min(...ttls);
  if (gap !== 0) return gap > 0;
  const [fa, fv] = [fractionOf(at), fractionOf(item.valid_from)];
  const width = Math.max(fa.length, fv.length);
  return fa.padEnd(width, "0") >= fv.padEnd(width, "0");
}

/**
 * Invariant 1: may `actor` see `item` at time `at` under `policy`? Not when
 * it is past its ttl: lifecycle is an admissibility axis (ADR 0025), so an
 * expired item is out before any sweep retires it.
 */
export function readable(policy: Policy, actor: Actor, item: MemoryItem, at: string): boolean {
  if (pastTtl(policy, item, at)) return false;
  const row = policy.read.matrix.filter((r) => r.reader === actor.level);
  const levels = row[0]?.may_read ?? [];
  const byScope =
    actor.memberships.indexOf(item.scope) !== -1 && levels.some((l) => l === level(item.scope));
  if (byScope) return true;
  if (!policy.read.honour_grants) return false;
  for (const g of item.grants) {
    if (!patternCovers(g.to, actor.id)) continue;
    if (g.class !== undefined && g.class !== item.class) continue;
    if (g.expires !== undefined && !(compareTimestamps(at, g.expires) < 0)) continue;
    return true;
  }
  return false;
}

/**
 * A grant the gate accepts (decision D4): it names a class and an expiry, and
 * its `to` is a principal without `*`, or `<kind>:<prefix>*` with a non-empty
 * prefix and the `*` only at the end.
 */
export function grantAllowed(g: Grant): boolean {
  if (g.class === undefined || g.expires === undefined) return false;
  const stars = g.to.split("*").length - 1;
  if (stars === 0) return true;
  if (stars > 1 || !g.to.endsWith("*")) return false;
  const colon = g.to.indexOf(":");
  return colon > 0 && g.to.length - 1 - (colon + 1) > 0;
}

/** The provenance kind the plane evaluates: the harness's source when it sets one. */
export const effectiveKind = (actor: Actor, item: MemoryItem) =>
  actor.source ?? item.provenance.kind;

/**
 * Invariant 2: does the policy forbid `item`'s class or source in its scope,
 * or forbid `actor` from writing it there? A non-member of the item's scope
 * may not write it, and no write may carry a grant the gate refuses, nor any
 * grant on model or compaction content (decision D4). Model and compaction
 * content may not land outside person scope (source isolation, ADR 0004 and
 * 0007): ADR 0004 lets it leave only through a gate pass, a promotion, which
 * no write is, and no policy field lifts the rule, so no policy allows it.
 * A model, compaction or tool write may not restate the content of an item
 * that an allowed retire or evict event retired in the same scope (ADR 0025,
 * review finding P4-3); `retiredByEvent` lists those items.
 */
export function writeForbidden(
  policy: Policy,
  actor: Actor,
  item: MemoryItem,
  retiredByEvent: readonly MemoryItem[] = [],
): boolean {
  if (!actor.memberships.some((m) => m === item.scope)) return true;
  const kind = effectiveKind(actor, item);
  const untrusted = kind === "model" || kind === "compaction" || kind === "external";
  const relearns = untrusted || kind === "tool";
  if (
    relearns &&
    retiredByEvent.some(
      (p) =>
        p.status === "retired" && p.scope === item.scope && sameContent(p.content, item.content),
    )
  )
    return true;
  if (item.grants.length > 0 && untrusted) return true;
  if (!item.grants.every(grantAllowed)) return true;
  if (untrusted && level(item.scope) !== "person") return true;
  const rule = policy.write.find((r) => r.scope === level(item.scope));
  if (!rule) return false;
  return rule.forbidden_classes.includes(item.class) || !rule.allowed_sources.includes(kind);
}

/**
 * Do two contents read the same? Written apart from core's content-hash.ts:
 * text code point by code point, dropping default-ignorable code points
 * (and the Hangul fillers by name) after NFKC, NFKC again, lower case, words
 * joined by one space; objects key
 * by key in sorted order, arrays in order, every string read as text; and
 * text never equals an object.
 */
/** Code points that render as nothing, named one by one besides the property. */
const IGNORABLE: ReadonlySet<string> = new Set(["\u3164", "\u115F", "\u180E", "\u200B", "\uFEFF"]);

export function sameContent(a: unknown, b: unknown): boolean {
  const text = (s: string) =>
    [...s.normalize("NFKC")]
      .filter((ch) => !IGNORABLE.has(ch) && !/^\p{Default_Ignorable_Code_Point}$/u.test(ch))
      .join("")
      .normalize("NFKC")
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w !== "")
      .join(" ");
  if (typeof a === "string" || typeof b === "string")
    return typeof a === "string" && typeof b === "string" && text(a) === text(b);
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((x, i) => sameContent(x, b[i]))
    );
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return (
      ka.join("\u0000") === kb.join("\u0000") &&
      ka.every((k) =>
        sameContent((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
      )
    );
  }
  return a === b;
}

/**
 * Invariant 5: what a budget check must do to `active`, the active items of
 * one scope and class: nothing at or under `budget`; over it, `ask` for a
 * manual rule, else the ids to evict, worst first, chosen one at a time:
 * for recency the item changed least recently (`lastChanged`, the seq of
 * its last changing event, -1 when unknown), for utility the item fewest
 * reads returned (`reads`), then the least recently changed; the lower id
 * breaks what is left. `protect`, the item a write just landed, counts but
 * is never chosen (review finding P4-1). The caller leaves items past their
 * ttl out of `active` (P4-2).
 */
export function budgetVictims(
  eviction: Policy["retention"][number]["eviction"],
  budget: number,
  active: readonly MemoryItem[],
  lastChanged: ReadonlyMap<string, number>,
  reads: ReadonlyMap<string, number>,
  protect?: string,
): string[] | "ask" {
  if (active.length <= budget) return [];
  if (eviction === "manual") return "ask";
  const key = (i: MemoryItem): number[] => {
    const changed = lastChanged.get(i.id) ?? -1;
    return eviction === "utility" ? [reads.get(i.id) ?? 0, changed] : [changed];
  };
  const worse = (a: MemoryItem, b: MemoryItem) => {
    const [ka, kb] = [key(a), key(b)];
    for (let k = 0; k < ka.length; k++)
      if ((ka[k] as number) !== (kb[k] as number)) return (ka[k] as number) < (kb[k] as number);
    return a.id < b.id;
  };
  // The item a write just landed is never its own check's victim (P4-1).
  const left = active.filter((i) => i.id !== protect);
  let over = active.length - budget;
  const victims: string[] = [];
  while (over-- > 0) {
    let pick = 0;
    for (let j = 1; j < left.length; j++)
      if (worse(left[j] as MemoryItem, left[pick] as MemoryItem)) pick = j;
    victims.push((left.splice(pick, 1)[0] as MemoryItem).id);
  }
  return victims;
}

/** Provenance kinds, most trusted first (ADR 0004, ADR 0026). */
export const TRUST = [
  "user",
  "document",
  "import",
  "tool",
  "model",
  "compaction",
  "external",
] as const;
const SCOPE_RANK = ["person", "role", "team", "org"];

/**
 * The strict reading of "the same content" for promotions (review findings
 * P5-12 and P5-14): whitespace runs collapsed, nothing else; case,
 * compatibility forms and invisible characters all stay, so "US" never
 * confirms "us" and a hidden payload never matches plain text. Written apart
 * from core's content-hash.ts.
 */
export function sameStrictContent(a: unknown, b: unknown): boolean {
  const text = (s: string) =>
    s
      .split(/\s+/)
      .filter((w) => w !== "")
      .join(" ");
  if (typeof a === "string" || typeof b === "string")
    return typeof a === "string" && typeof b === "string" && text(a) === text(b);
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((x, i) => sameStrictContent(x, b[i]))
    );
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return (
      ka.join("\u0000") === kb.join("\u0000") &&
      ka.every((k) =>
        sameStrictContent((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
      )
    );
  }
  return a === b;
}

/**
 * Does `content` hold a character a reader would not see (P5-14)? Judged code
 * point by code point: the tag block U+E0000 to U+E007F, a format character
 * (Cf), or any other default-ignorable code point. Written apart from core.
 */
export function holdsHiddenText(content: unknown): boolean {
  if (typeof content === "string")
    return [...content].some((ch) => {
      const cp = ch.codePointAt(0) as number;
      return (
        (cp >= 0xe0000 && cp <= 0xe007f) ||
        /^\p{Cf}$/u.test(ch) ||
        /^\p{Default_Ignorable_Code_Point}$/u.test(ch)
      );
    });
  if (Array.isArray(content)) return content.some(holdsHiddenText);
  if (content !== null && typeof content === "object")
    return Object.entries(content).some(([k, v]) => holdsHiddenText(k) || holdsHiddenText(v));
  return false;
}

/** The items as the log leaves them, replayed by the oracle itself. */
function replayed(events: readonly MemoryEvent[]): Map<string, MemoryItem> {
  const out = new Map<string, MemoryItem>();
  for (const e of events) {
    if (e.decision !== "allow" || e.item_id === null) continue;
    if ((e.op === "write" || e.op === "update" || e.op === "promote") && e.item)
      out.set(e.item_id, e.item);
    const was = out.get(e.item_id);
    if ((e.op === "retire" || e.op === "evict") && was)
      out.set(e.item_id, { ...was, status: "retired" });
  }
  return out;
}

/**
 * Invariant 2 for promotions (ADR 0026 and its review fix pass): may `actor`
 * land a promotion of item `sourceId` into `target` at `at`, given the log
 * `events` before it? Necessary conditions only, so the property is
 * soundness, all judged from the oracle's own replay of the events:
 *
 * - the actor can read the source as `readable` says (scope or live grant),
 *   which also leaves out an item past its ttl (P5-4, P5-7), and is a
 *   member of the source's scope or its owner in the owner's person scope:
 *   a grant never moves an item (P5-15);
 * - the content holds no hidden character (P5-14);
 * - the source is not retired, and the target is its scope or a scope at a
 *   wider level; a scope change is asked for by a user-sourced actor (P5-3);
 * - no other active item of the promoted class in the target holds the
 *   content (strict reading, P5-5);
 * - an actor asking to review is a reviewer: user-sourced, a member of the
 *   target, not the owner, and not the actor of any allowed write or update
 *   of the source or a version its lineage reaches (P5-1), nor of a write
 *   that confirms it (P5-16); a target whose
 *   rule requires review is reached only through a reviewer;
 * - an episodic item needs at least k distinct actors among the allowed
 *   writes, in its scope, of its content (strict reading), with a user,
 *   document or tool source, of items still active now (the item's own
 *   write aside), or a reviewer where the policy allows review; a
 *   procedural candidate never lands (no validation record reaches the
 *   plane before card D3); anything else needs a reviewer.
 *
 * Whether the landed item may be written into the target is `writeForbidden`'s.
 */
export function promotionPermitted(
  policy: Policy,
  actor: Actor,
  sourceId: string,
  target: string,
  events: readonly MemoryEvent[],
  review: boolean,
  at: string,
): boolean {
  const items = replayed(events);
  const source = items.get(sourceId);
  if (!source) return false;
  if (!readable(policy, actor, source, at)) return false;
  const ownPerson = actor.id === source.owner && source.scope === actor.id;
  if (actor.memberships.indexOf(source.scope) === -1 && !ownPerson) return false;
  if (source.status === "retired") return false;
  if (holdsHiddenText(source.content)) return false;
  const widening = target !== source.scope;
  if (
    widening &&
    !(
      SCOPE_RANK.indexOf(level(target) as string) >
      SCOPE_RANK.indexOf(level(source.scope) as string)
    )
  )
    return false;
  if (widening && actor.source !== "user") return false;
  const promotedClass = source.class === "episodic" ? "semantic" : source.class;
  for (const other of items.values())
    if (
      other.id !== sourceId &&
      other.status === "active" &&
      other.scope === target &&
      other.class === promotedClass &&
      sameStrictContent(other.content, source.content)
    )
      return false;
  // The source and every version its lineage reaches, and who wrote them.
  const versions = new Set<string>();
  const queue = [sourceId];
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    if (versions.has(id)) continue;
    versions.add(id);
    queue.push(...(items.get(id)?.lineage ?? []));
  }
  const authors = new Set<string>();
  for (const e of events)
    if (
      (e.op === "write" || e.op === "update") &&
      e.decision === "allow" &&
      e.item_id !== null &&
      versions.has(e.item_id)
    )
      authors.add(e.actor);
  // Who confirms it: the actors of allowed writes, in its scope, of its
  // content (strict reading), with a user, document or tool source, of items
  // still active now (the item's own write aside).
  const actors = new Set<string>();
  for (const e of events) {
    const w = e.item;
    if (e.op !== "write" || e.decision !== "allow" || !w) continue;
    if (w.scope !== source.scope) continue;
    const kind = w.provenance.kind;
    if (kind !== "user" && kind !== "document" && kind !== "tool") continue;
    if (w.id !== sourceId && items.get(w.id)?.status !== "active") continue;
    if (sameStrictContent(w.content, source.content)) actors.add(e.actor);
  }
  const reviewer =
    actor.source === "user" &&
    actor.id !== source.owner &&
    !authors.has(actor.id) &&
    !actors.has(actor.id) &&
    actor.memberships.indexOf(target) !== -1;
  if (review && !reviewer) return false;
  const reviewed = review && reviewer;
  const rule = policy.write.filter((r) => r.scope === level(target))[0];
  if (rule?.requires_review && !reviewed) return false;
  if (source.class === "episodic") {
    const { confirmations, or_review } = policy.promotion.episodic_to_semantic;
    return actors.size >= confirmations || (or_review && reviewed);
  }
  if (source.class === "procedural" && source.status === "candidate") return false;
  return reviewed;
}
