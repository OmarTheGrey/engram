// The grant-change gate (card E9.4, ADR 0034, proposed): pure, like the rest
// of the evaluator. A grant is the owner's consent that another principal
// may read one item (ADR 0021), so a change of an item's grants is decided
// here, from the actor, the projected item, the change and the time; the
// plane (plane/grants.ts) commits the decision as one `update` event. What a
// grant being added may be is one check, grantDefect in ./evaluate.ts, which
// the write gate runs too (review finding M1 of PR #44); so are the owner and
// source rules, which the write gate applies to a rewrite that changes an
// item's grants (finding I1).
//
// Rule ids:
//   engram/grant/change      an allowed change
//   engram/grant/owner       the actor cannot read the item's scope as a member, or is not its owner
//   engram/grant/source      the actor is not user-sourced: consent is a person's act, never an agent's
//   engram/grant/status      the item is retired
//   engram/grant/expired     an added grant has expired already
//   engram/grant/unchanged   a removal names a grant the item does not carry, or an addition one it does
//   engram/grant/conflict    the item changed or was erased on another handle of the log before the commit (plane/grants.ts)
//   engram/write/grant       an added grant the write gate refuses (ADR 0021, decision D4), or of another class than the item's
//   engram/write/grant-expiry-cap   an added grant expiring more than 365 days after `at`, under grants.expiry_cap (card E2.21)
import type { Actor } from "../actor.ts";
import type { Grant, MemoryItem, Policy } from "../schema.ts";
import {
  expiryCapOn,
  GRANT_EXPIRED_ID,
  GRANT_OWNER_ID,
  GRANT_SOURCE_ID,
  GRANT_UNCHANGED_ID,
  grantDefect,
  grantText,
  readableScope,
  sameGrant,
} from "./evaluate.ts";

export {
  GRANT_EXPIRED_ID,
  GRANT_OWNER_ID,
  GRANT_SOURCE_ID,
  GRANT_UNCHANGED_ID,
  grantDefect,
  grantText,
  sameGrant,
};
export const GRANT_CHANGE_ID = "engram/grant/change";
export const GRANT_STATUS_ID = "engram/grant/status";
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
   * Whether the event may name the item's scope: false when the actor cannot
   * read it as a member (or the item is unknown), so a refusal says nothing
   * about an item the actor cannot reach (decision D5, finding M6 of PR #44).
   */
  visible: boolean;
}

/**
 * The gate on a grant change. Checks run in a fixed order and the first
 * failure decides: the item exists and the actor may read its scope as a
 * member (otherwise the refusal is the same for an unknown and a hidden item,
 * and names neither scope nor owner); the actor is user-sourced; the actor is
 * the item's owner; the item is not retired; every removal names a grant the
 * item carries; every addition passes grantDefect (the write gate's grant
 * rule, the item's class, unexpired at `at`, within 365 days of `at` when
 * grants.expiry_cap is on, not on the item already). On
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
  if (!item || !readableScope(policy, actor, item.scope))
    return deny(
      GRANT_OWNER_ID,
      `item ${itemId} is not one ${actor.id} can change: only its owner, a member of its scope who may read it, changes its grants`,
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
    const defect = grantDefect(g, item, [...kept, ...added.slice(0, i)], at, expiryCapOn(policy));
    if (defect) return deny(defect.policy_id, `add[${i}]: ${defect.problem}`);
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
