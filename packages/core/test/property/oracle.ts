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

/** Invariant 1: may `actor` see `item` at time `at` under `policy`? */
export function readable(policy: Policy, actor: Actor, item: MemoryItem, at: string): boolean {
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
 */
export function writeForbidden(policy: Policy, actor: Actor, item: MemoryItem): boolean {
  if (!actor.memberships.some((m) => m === item.scope)) return true;
  const kind = effectiveKind(actor, item);
  const untrusted = kind === "model" || kind === "compaction";
  if (item.grants.length > 0 && untrusted) return true;
  if (!item.grants.every(grantAllowed)) return true;
  if (untrusted && level(item.scope) !== "person") return true;
  const rule = policy.write.find((r) => r.scope === level(item.scope));
  if (!rule) return false;
  return rule.forbidden_classes.includes(item.class) || !rule.allowed_sources.includes(kind);
}
