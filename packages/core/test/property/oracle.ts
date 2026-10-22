// The invariant oracles: what a policy permits, written independently of any
// Plane. Part of the lead-owned invariants file (docs/conventions/testing.md):
// changes need a second reviewer and a `decision` log entry. They encode
// ADR 0006 as amended; one commitment awaits the lead's confirmation: an item
// in `org` scope is readable through scope only by an actor whose memberships
// include "org".
import type { Actor } from "../../src/plane.ts";
import type { MemoryItem, Policy } from "../../src/schema.ts";

const level = (scope: string) => (scope === "org" ? "org" : scope.split(":")[0]);

function grantMatches(pattern: string, actorId: string): boolean {
  return pattern.endsWith("*") ? actorId.startsWith(pattern.slice(0, -1)) : pattern === actorId;
}

/** Invariant 1: may `actor` see `item` at time `at` under `policy`? */
export function readable(policy: Policy, actor: Actor, item: MemoryItem, at: string): boolean {
  const mayRead = policy.read.matrix.find((r) => r.reader === actor.level)?.may_read ?? [];
  const byScope =
    actor.memberships.includes(item.scope) &&
    mayRead.includes(level(item.scope) as (typeof mayRead)[number]);
  const byGrant =
    policy.read.honour_grants &&
    item.grants.some(
      (g) =>
        grantMatches(g.to, actor.id) &&
        (g.class === undefined || g.class === item.class) &&
        (g.expires === undefined || Date.parse(g.expires) > Date.parse(at)),
    );
  return byScope || byGrant;
}

/** Invariant 2: does the policy forbid `item`'s class or source in its scope? */
export function writeForbidden(policy: Policy, item: MemoryItem): boolean {
  const rule = policy.write.find((r) => r.scope === level(item.scope));
  if (!rule) return false;
  return (
    rule.forbidden_classes.includes(item.class) ||
    !rule.allowed_sources.includes(item.provenance.kind)
  );
}
