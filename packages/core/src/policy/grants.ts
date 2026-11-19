// The grant-change gate (card E9.4, ADR 0034, proposed): pure, like the rest
// of the evaluator. A grant is the owner's consent that another principal
// may read one item (ADR 0021), so a change of an item's grants is decided
// here, from the actor, the projected item, the change and the time; the
// plane (plane/grants.ts) commits the decision as one `update` event.
//
// Rule ids:
//   engram/grant/change      an allowed change
//   engram/grant/owner       the actor cannot reach the item by membership, or is not its owner
//   engram/grant/source      the actor is not user-sourced: consent is a person's act, never an agent's
//   engram/grant/status      the item is retired
//   engram/grant/expired     an added grant has expired already
//   engram/grant/unchanged   a removal names a grant the item does not carry, or an addition one it does
//   engram/grant/conflict    the item changed or was erased on another handle of the log before the commit (plane/grants.ts)
//   engram/write/grant       an added grant the write gate refuses (ADR 0021, decision D4)
import type { Actor } from "../actor.ts";
import type { Grant, MemoryItem, Policy } from "../schema.ts";
import { compareTimestamps } from "../time.ts";
import { grantProblem, WRITE_GRANT_ID } from "./evaluate.ts";

export const GRANT_CHANGE_ID = "engram/grant/change";
export const GRANT_OWNER_ID = "engram/grant/owner";
export const GRANT_SOURCE_ID = "engram/grant/source";
export const GRANT_STATUS_ID = "engram/grant/status";
export const GRANT_EXPIRED_ID = "engram/grant/expired";
export const GRANT_UNCHANGED_ID = "engram/grant/unchanged";
export const GRANT_CONFLICT_ID = "engram/grant/conflict";

/** What a grant change asks for: grants to add and grants to remove, each as the item carries it. */
export interface GrantChange {
  add?: Grant[];
  remove?: Grant[];
}

export interface GrantDecision {
  decision: "allow" | "deny";
  reason: string;
  policy_id: string;
  /** The item's grants after the change, in order: kept ones first, then the added ones; null on deny. */
  grants: Grant[] | null;
  /**
   * Whether the event may name the item's scope: false when the actor is not
   * a member of it (or the item is unknown), so a refusal says nothing about
   * an item the actor cannot reach (decision D5).
   */
  visible: boolean;
}

/** Two grants are one when every field is equal, the expiry compared as an instant. */
export function sameGrant(a: Grant, b: Grant): boolean {
  const expiry =
    a.expires === undefined || b.expires === undefined
      ? a.expires === b.expires
      : compareTimestamps(a.expires, b.expires) === 0;
  return a.to === b.to && a.class === b.class && a.mode === b.mode && expiry;
}

/** A grant as a reason names it. */
export function grantText(g: Grant): string {
  return `grant to ${g.to} (class ${g.class ?? "any"}, mode ${g.mode}, expires ${g.expires ?? "never"})`;
}

/**
 * The gate on a grant change. Checks run in a fixed order and the first
 * failure decides: the item exists and the actor is a member of its scope
 * (otherwise the refusal is the same for an unknown and a hidden item); the
 * actor is user-sourced; the actor is the item's owner; the item is not
 * retired; every removal names a grant the item carries; every addition is a
 * grant the write gate accepts (a principal or a prefixed pattern, a class,
 * an expiry, and no grants on model or compaction content: grantProblem,
 * decision D4), has not expired at `at`, and is not on the item already. On
 * allow, the grants are the item's without the removed ones, then the added.
 * A grant authorises reads only, whatever its mode (ADR 0006, decision D4).
 */
export function evaluateGrantChange(
  policy: Policy,
  actor: Actor,
  itemId: string,
  item: MemoryItem | undefined,
  change: GrantChange,
  at: string,
): GrantDecision {
  const deny = (policy_id: string, reason: string, visible = true): GrantDecision => ({
    decision: "deny",
    reason,
    policy_id,
    grants: null,
    visible,
  });
  if (!item || !actor.memberships.includes(item.scope))
    return deny(
      GRANT_OWNER_ID,
      `item ${itemId} is not one ${actor.id} can change: only its owner, a member of its scope, changes its grants`,
      false,
    );
  if (actor.source !== "user")
    return deny(
      GRANT_SOURCE_ID,
      `${actor.id} is ${actor.source === undefined ? "not user-sourced" : `${actor.source}-sourced`}; a grant is the owner's consent, given by the person, never by an agent`,
    );
  if (actor.id !== item.owner)
    return deny(GRANT_OWNER_ID, `only its owner ${item.owner} may change the grants of ${item.id}`);
  if (item.status === "retired")
    return deny(GRANT_STATUS_ID, `item ${item.id} is retired; its grants are not changed`);

  const removed = change.remove ?? [];
  const added = change.add ?? [];
  for (const [i, g] of removed.entries())
    if (!item.grants.some((h) => sameGrant(g, h)))
      return deny(GRANT_UNCHANGED_ID, `remove[${i}]: item ${item.id} carries no ${grantText(g)}`);
  const kept = item.grants.filter((h) => !removed.some((g) => sameGrant(g, h)));
  for (const [i, g] of added.entries()) {
    const problem = grantProblem(g, item.provenance.kind);
    if (problem) return deny(WRITE_GRANT_ID, `add[${i}]: ${problem}`);
    if (g.expires !== undefined && compareTimestamps(g.expires, at) <= 0)
      return deny(
        GRANT_EXPIRED_ID,
        `add[${i}]: the ${grantText(g)} has expired by ${at}; it would never admit a read`,
      );
    if ([...kept, ...added.slice(0, i)].some((h) => sameGrant(g, h)))
      return deny(
        GRANT_UNCHANGED_ID,
        `add[${i}]: item ${item.id} already carries the ${grantText(g)}`,
      );
  }

  const words = [
    ...added.map((g) => `added ${grantText(g)}`),
    ...removed.map((g) => `removed ${grantText(g)}`),
  ];
  const honoured = policy.read.honour_grants
    ? ""
    : `; policy ${policy.id} does not honour grants, so no read is admitted by them under it`;
  return {
    decision: "allow",
    reason: `${actor.id}, its owner, changed the grants of ${item.id}: ${words.join("; ")}; version ${item.version} to ${item.version + 1}${honoured}`,
    policy_id: GRANT_CHANGE_ID,
    grants: [...kept, ...added],
    visible: true,
  };
}
