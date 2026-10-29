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
import type { Actor } from "../../src/plane.ts";
import type { Grant, MemoryItem, Policy } from "../../src/schema.ts";
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
  const untrusted = kind === "model" || kind === "compaction";
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
 * text code point by code point, dropping format characters (category Cf)
 * and U+180E after NFKC, lower case, words joined by one space; objects key
 * by key in sorted order, arrays in order, every string read as text; and
 * text never equals an object.
 */
export function sameContent(a: unknown, b: unknown): boolean {
  const text = (s: string) =>
    [...s.normalize("NFKC")]
      .filter((ch) => ch !== "\u180E" && !/^\p{Cf}$/u.test(ch))
      .join("")
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
