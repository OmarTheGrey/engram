// The promotion evaluator (card E2.5, ADR 0026): pure, like the write, read
// and retention evaluators. Given a policy, the promoting actor, the item, the
// target scope and the evidence the plane gathered from the log, it decides
// with a reason and the id of the rule that decided, and gives the item as it
// would stand after the promotion. No clock, no store, no model; the plane
// (plane/promote.ts) gathers the evidence and commits the decision.
//
// Rule ids:
//   <policy id>/promotion/episodic-to-semantic   k confirmations reached
//   <policy id>/promotion/review                 a reviewer approved, or a review is asked for
//   <policy id>/promotion/procedural             a validation record meets replay_k of replay_n
//   <policy id>/promotion/superseded             the source of a new version is retired (plane)
//   engram/promote/membership                    the actor cannot read the item (opaque), or reads it
//                                                but is not a member of its scope (nor its owner in
//                                                the owner's person scope): grants never move an item
//   engram/promote/hidden-text                   the content holds default-ignorable, format or tag characters
//   engram/promote/not-candidate                 nothing to promote: retired, already active there, or not a widening
//   engram/promote/expired                       the item is past its ttl (the read path's rule, ADR 0025)
//   engram/promote/widening-source               a scope change by an actor that is not user-sourced
//   engram/promote/duplicate                     an active item of the target class already holds the content there
//   engram/promote/no-evidence                   too few confirmations, no reviewer, or no validation record
//   engram/promote/reviewer                      the actor asked to approve but is not a reviewer
// A promotion the target's write rule refuses is denied under that rule's own
// id (`<policy id>/write/<level>`, `engram/write/membership`, ...), since a
// promotion is evaluated as a write into the target scope (ADR 0026, item 5).
import type { Actor } from "../actor.ts";
import type { MemoryItem, Policy, ScopeLevel } from "../schema.ts";
import { compareTimestamps } from "../time.ts";
import {
  evaluateWrite,
  grantMatches,
  readableScope,
  scopeLevel,
  type WriteDecision,
} from "./evaluate.ts";
import { itemExpiry } from "./retention.ts";

export const PROMOTE_MEMBERSHIP_ID = "engram/promote/membership";
export const PROMOTE_EXPIRED_ID = "engram/promote/expired";
export const PROMOTE_WIDENING_SOURCE_ID = "engram/promote/widening-source";
export const PROMOTE_DUPLICATE_ID = "engram/promote/duplicate";
export const PROMOTE_HIDDEN_TEXT_ID = "engram/promote/hidden-text";

/**
 * Characters that render as nothing: default-ignorable code points, format
 * characters (Cf) and the tag block U+E0000 to U+E007F, which can spell a
 * payload a reader never sees (ASCII smuggling, review finding P5-14).
 */
const HIDDEN = /[\p{Default_Ignorable_Code_Point}\p{Cf}\u{E0000}-\u{E007F}]/u;

/** How many hidden characters every string in `content` holds together. */
export function hiddenCharacters(content: unknown): number {
  if (typeof content === "string") {
    let n = 0;
    for (const ch of content) if (HIDDEN.test(ch)) n++;
    return n;
  }
  if (Array.isArray(content)) return content.reduce((n: number, v) => n + hiddenCharacters(v), 0);
  if (content !== null && typeof content === "object")
    return Object.entries(content).reduce(
      (n, [k, v]) => n + hiddenCharacters(k) + hiddenCharacters(v),
      0,
    );
  return 0;
}
export const PROMOTE_NOT_CANDIDATE_ID = "engram/promote/not-candidate";
export const PROMOTE_NO_EVIDENCE_ID = "engram/promote/no-evidence";
export const PROMOTE_REVIEWER_ID = "engram/promote/reviewer";

type Kind = MemoryItem["provenance"]["kind"];

export function promotionRuleId(
  policy: Policy,
  rule: "episodic-to-semantic" | "review" | "procedural" | "superseded",
): string {
  return `${policy.id}/promotion/${rule}`;
}

/**
 * Sources whose writes count as confirmations (ADR 0026, item 2): a person, a
 * document or a tool, each an independent principal. Model and compaction
 * content is derived and cannot elevate (2606.24322); an import records what
 * a store already held and corroborates nothing.
 */
export const CONFIRMING_KINDS: ReadonlySet<Kind> = new Set(["user", "document", "tool"]);

/**
 * Provenance kinds from most to least trusted. The trusted three of ADR 0025
 * (user, document, import: the sources that may re-admit retired content)
 * come first, then tool, model and compaction, the lowest (ADR 0004).
 */
const TRUST_ORDER: readonly Kind[] = ["user", "document", "import", "tool", "model", "compaction"];

/** The least trusted of `kinds` (ADR 0004: a derived item inherits the least trusted of its inputs). */
export function leastTrusted(kinds: readonly Kind[]): Kind {
  let worst = 0;
  for (const k of kinds) worst = Math.max(worst, TRUST_ORDER.indexOf(k));
  return TRUST_ORDER[worst] as Kind;
}

/** Levels from narrowest to widest; a promotion keeps or widens the scope. */
const LEVEL_ORDER: readonly ScopeLevel[] = ["person", "role", "team", "org"];

/** One allowed write of the item's content in its scope, as the log recorded it. */
export interface Confirmation {
  item_id: string;
  /** The actor the write event names. */
  actor: string;
  /** The provenance kind the written item carried. */
  kind: Kind;
  /** The written item's status now; only an active item confirms (review finding P5-5). */
  status: MemoryItem["status"];
}

/** Where a promotion goes, and when it is asked for. */
export interface PromotionTarget {
  scope: string;
  /** The time expiry and grant reach are judged at; injected, never read from a clock. */
  at: string;
}

/** A replay validation record: `k` passes in `n` runs on held-out tasks (card D3). */
export interface ValidationRecord {
  k: number;
  n: number;
}

export interface PromotionEvidence {
  /**
   * Every allowed write, in log order, of an item in the promoted item's
   * scope whose normalised content hash equals the item's (ADR 0018), the
   * item's own write included. The evaluator applies the trusted-kind and
   * distinct-actor rules; the plane only gathers.
   */
  confirmations: readonly Confirmation[];
  /**
   * Every actor of an allowed write or update event on the item or any
   * version in its lineage: none of them may approve it, whoever the item
   * names as owner (review finding P5-1).
   */
  authors: readonly string[];
  /**
   * An active item of the promoted class in the target scope that already
   * holds the item's content (strict normal form), if there is one (P5-5).
   */
  duplicate?: string;
  /** The actor asks to approve the promotion as a reviewer. */
  review: boolean;
  /** For a procedural candidate: its replay validation record, when one exists. */
  validation?: ValidationRecord;
}

export type PromotionCheck =
  | "membership"
  | "not-candidate"
  | "expired"
  | "hidden-text"
  | "widening-source"
  | "duplicate"
  | "write"
  | "reviewer"
  | "no-evidence"
  | "review-needed"
  | "confirmed"
  | "reviewed"
  | "validated";

export interface PromotionDecision {
  decision: "allow" | "deny" | "ask";
  check: PromotionCheck;
  reason: string;
  policy_id: string;
  /**
   * `in-place` for a status-only change (same id, version plus one), `new`
   * for a class or scope change (a new version the plane gives a fresh id,
   * retiring the source); null when nothing would be promoted.
   */
  transition: "in-place" | "new-version" | null;
  /**
   * The item as it would stand on allow, else null. For a new version its id
   * is still the source's: the plane assigns the new id.
   */
  promoted: MemoryItem | null;
  /** Distinct actors among the trusted confirmations, the item's own write included. */
  confirmations: number;
  /** The confirming items, one per counted actor other than the item itself, in log order. */
  confirming: string[];
}

/** The trusted confirmations, one per item (its first trusted write) and then one per actor. */
function countConfirmations(item: MemoryItem, all: readonly Confirmation[]) {
  const byItem = new Set<string>();
  const byActor = new Map<string, Confirmation>();
  const confirmers = new Set<string>();
  for (const c of all) {
    // The item's own write counts whatever its status: it is the one promoted.
    if (c.item_id !== item.id && c.status !== "active") continue;
    if (!CONFIRMING_KINDS.has(c.kind)) continue;
    // Every actor of a write that confirms, for the reviewer rule (P5-16).
    confirmers.add(c.actor);
    if (byItem.has(c.item_id)) continue;
    byItem.add(c.item_id);
    if (!byActor.has(c.actor)) byActor.set(c.actor, c);
  }
  const counted = [...byActor.values()];
  return {
    count: counted.length,
    actors: counted.map((c) => c.actor),
    confirming: counted.filter((c) => c.item_id !== item.id),
    confirmers: [...confirmers],
  };
}

/**
 * Why `actor` may not approve a promotion of `item` into `target`, or null
 * (ADR 0026, item 3): it owns the item, wrote a version of it (`authors`,
 * P5-1), is not user-sourced, or is not a member of the target.
 */
export function reviewerProblem(
  actor: Actor,
  item: MemoryItem,
  target: string,
  authors: readonly string[] = [],
  confirmers: readonly string[] = [],
): string | null {
  if (actor.id === item.owner)
    return `${actor.id} owns item ${item.id} and cannot approve its own item`;
  if (authors.includes(actor.id))
    return `${actor.id} wrote item ${item.id} or a version of it and cannot approve its own item`;
  if (confirmers.includes(actor.id))
    return `${actor.id} confirmed item ${item.id} by restating it and cannot also approve its promotion`;
  if (actor.source !== "user")
    return `${actor.id} acts with source ${actor.source ?? "none"}; only a user-sourced actor can approve`;
  if (!actor.memberships.includes(target))
    return `${actor.id} is not a member of ${target}, so cannot approve a promotion into it`;
  return null;
}

/**
 * Does a validation record meet the policy: at least replay_k passes, at
 * least replay_n runs, and a pass rate at least replay_k / replay_n (so 4
 * passes in 100 runs does not meet 4 of 5).
 */
export function validationMeets(policy: Policy, v: ValidationRecord): boolean {
  const { replay_k, replay_n } = policy.promotion.procedural;
  return (
    Number.isInteger(v.k) &&
    Number.isInteger(v.n) &&
    v.k >= replay_k &&
    v.n >= replay_n &&
    v.k <= v.n &&
    v.k * replay_n >= replay_k * v.n
  );
}

/**
 * Can `actor` read `item` at `at`, as `read` would reach it: by a readable
 * scope (membership and the read matrix), or by a live grant naming it whose
 * class is absent or the item's (when the policy honours grants). Status,
 * ttl and validity are judged separately.
 */
export function canReach(policy: Policy, actor: Actor, item: MemoryItem, at: string): boolean {
  if (readableScope(policy, actor, item.scope)) return true;
  return (
    policy.read.honour_grants &&
    item.grants.some(
      (g) =>
        grantMatches(g.to, actor.id) &&
        (g.class === undefined || g.class === item.class) &&
        (g.expires === undefined || compareTimestamps(g.expires, at) > 0),
    )
  );
}

/**
 * The promotion gate (ADR 0026). Checks run in a fixed order and the first
 * failure decides:
 *
 * 1. The actor can read the item (`canReach`); otherwise the reason names
 *    nothing about it (`engram/promote/membership`, P5-7). Reading is not
 *    enough to move it: the actor must also be a member of its scope, or its
 *    owner in the owner's person scope (P5-15), else a named refusal under
 *    the same id.
 * 2. The item is a candidate: not retired; the target is its own scope or a
 *    scope at a wider level; and something changes (an episodic item becomes
 *    semantic, a candidate becomes active, or the scope widens). It is not
 *    past its ttl (`engram/promote/expired`, P5-4), and its content holds no
 *    hidden characters (`engram/promote/hidden-text`, P5-14).
 * 3. A scope change needs a user-sourced actor
 *    (`engram/promote/widening-source`, P5-3); choosing where content is
 *    disclosed is an authority act. A same-scope change keeps the rules below.
 * 4. No active item of the promoted class in the target already holds the
 *    content (`engram/promote/duplicate`, P5-5).
 * 5. The promoted item is judged as a write into the target scope by
 *    `evaluateWrite`: membership, grants, the rule's classes, sources, floor
 *    and the retired-content rule (`retired`, as for a write). A status-only
 *    change is judged against the item itself as the projected one.
 * 6. An actor asking to review must be a reviewer: not the owner, not an
 *    author of any version, not a confirmer (P5-16), user-sourced, a member
 *    of the target
 *    (`engram/promote/reviewer`).
 * 7. Evidence: an episodic item needs k confirmations or, when `or_review`
 *    holds, a reviewer; a procedural candidate needs a validation record
 *    meeting replay_k of replay_n, which a review cannot replace; anything
 *    else (a semantic candidate, a widening of an active item) needs a
 *    reviewer. Missing evidence that a review could supply asks when the
 *    target requires review, else denies (`engram/promote/no-evidence`).
 * 8. A target whose rule requires review asks when the actor is not
 *    reviewing, even with the evidence (decision `ask`, no item).
 *
 * A status-only change is in place: same id, version plus one, active. A
 * class or scope change is a new version: class semantic for an episodic
 * item, scope the target, version plus one, lineage naming the source and
 * every confirming item, provenance kind the least trusted among the source
 * and the confirming items, provenance actor the promoting actor.
 */
export function evaluatePromotion(
  policy: Policy,
  actor: Actor,
  item: MemoryItem,
  { scope: target, at }: PromotionTarget,
  evidence: PromotionEvidence,
  retired: ReadonlyMap<string, string>,
): PromotionDecision {
  const counted = countConfirmations(item, evidence.confirmations);
  const base = {
    transition: null,
    promoted: null,
    confirmations: counted.count,
    confirming: counted.confirming.map((c) => c.item_id),
  } as const;
  const deny = (check: PromotionCheck, reason: string, policy_id: string): PromotionDecision => ({
    ...base,
    decision: "deny",
    check,
    reason,
    policy_id,
  });

  if (!canReach(policy, actor, item, at))
    return deny(
      "membership",
      `item ${item.id} is not one ${actor.id} can access, so it cannot promote it`,
      PROMOTE_MEMBERSHIP_ID,
    );
  // Reach only chooses between the opaque refusal above and a named one: a
  // read grant never lets anyone move or retire an item (ADR 0006, decision
  // D4; review finding P5-15). The promoter belongs to the item's scope, or
  // owns the item in its own person scope.
  const ownPerson = actor.id === item.owner && item.scope === actor.id;
  if (!actor.memberships.includes(item.scope) && !ownPerson)
    return deny(
      "membership",
      `${actor.id} is not a member of ${item.scope}; a grant lets others read an item, never move or retire it`,
      PROMOTE_MEMBERSHIP_ID,
    );

  const from = LEVEL_ORDER.indexOf(scopeLevel(item.scope));
  const to = LEVEL_ORDER.indexOf(scopeLevel(target));
  const sameScope = target === item.scope;
  const notCandidate = (why: string) => deny("not-candidate", why, PROMOTE_NOT_CANDIDATE_ID);
  if (item.status === "retired") return notCandidate(`item ${item.id} is retired`);
  if (!sameScope && to <= from)
    return notCandidate(
      `a promotion keeps an item's scope or widens it to a wider level; ${target} is not wider than ${item.scope}`,
    );
  const classChange = item.class === "episodic";
  if (sameScope && !classChange && item.status === "active")
    return notCandidate(`item ${item.id} is already active in ${target}`);
  const expiry = itemExpiry(policy, item);
  if (expiry !== null && compareTimestamps(expiry.at, at) <= 0)
    return deny(
      "expired",
      `item ${item.id} is past its ttl: expired at ${expiry.at} (${expiry.policy_id})`,
      PROMOTE_EXPIRED_ID,
    );
  const hidden = hiddenCharacters(item.content);
  if (hidden > 0)
    return deny(
      "hidden-text",
      `item ${item.id} holds ${hidden} hidden character${hidden === 1 ? "" : "s"} (default-ignorable, format or tag characters) that a reader would not see; it is not promoted`,
      PROMOTE_HIDDEN_TEXT_ID,
    );
  if (!sameScope && actor.source !== "user")
    return deny(
      "widening-source",
      `${actor.id} acts with source ${actor.source ?? "none"}; only a user-sourced actor may move content to another scope`,
      PROMOTE_WIDENING_SOURCE_ID,
    );
  if (evidence.duplicate !== undefined)
    return deny(
      "duplicate",
      readableScope(policy, actor, target)
        ? `active item ${evidence.duplicate} already holds this content in ${target}`
        : `an active item already holds this content in ${target}`,
      PROMOTE_DUPLICATE_ID,
    );

  const transition = sameScope && !classChange ? "in-place" : "new-version";
  const promoted: MemoryItem =
    transition === "in-place"
      ? { ...item, status: "active", version: item.version + 1 }
      : ({
          ...item,
          class: classChange ? "semantic" : item.class,
          scope: target,
          status: "active",
          version: item.version + 1,
          lineage: [item.id, ...base.confirming],
          provenance: {
            ...item.provenance,
            kind: leastTrusted([item.provenance.kind, ...counted.confirming.map((c) => c.kind)]),
            actor: actor.id,
          },
          store_ref: null,
        } as MemoryItem);

  // A promotion never lands where a write could not (ADR 0026, item 5).
  const write: WriteDecision = evaluateWrite(
    policy,
    actor,
    promoted,
    transition === "in-place" ? item : undefined,
    retired,
  );
  if (write.decision === "deny")
    return deny("write", `as a write into ${target}: ${write.reason}`, write.policy_id);
  const targetReview = write.check === "review";

  if (evidence.review) {
    const problem = reviewerProblem(actor, item, target, evidence.authors, counted.confirmers);
    if (problem) return deny("reviewer", problem, PROMOTE_REVIEWER_ID);
  }

  // What evidence the promotion needs, and whether a review can supply it.
  const { confirmations: k, or_review } = policy.promotion.episodic_to_semantic;
  let met: "confirmed" | "reviewed" | "validated" | null = null;
  let reviewable: boolean;
  let missing: string;
  if (classChange) {
    reviewable = or_review;
    if (counted.count >= k) met = "confirmed";
    else if (evidence.review && or_review) met = "reviewed";
    missing = `${counted.count} of the ${k} confirmations by distinct actors with a user, document or tool source${or_review ? ", and no reviewer approved it" : "; the policy has no review path"}`;
  } else if (item.class === "procedural" && item.status === "candidate") {
    reviewable = false;
    const v = evidence.validation;
    if (v && validationMeets(policy, v)) met = "validated";
    const { replay_k, replay_n } = policy.promotion.procedural;
    missing = v
      ? `the validation record ${v.k} of ${v.n} does not meet ${replay_k} of ${replay_n}`
      : `a procedural candidate needs a validation record of ${replay_k} of ${replay_n} replay passes, and has none`;
  } else {
    reviewable = true;
    if (evidence.review) met = "reviewed";
    missing = `${sameScope ? `the ${item.class} candidate` : `widening ${item.scope} to ${target}`} needs a reviewer's approval`;
  }

  const approved = evidence.review ? `; approved by ${actor.id}` : "";
  const askReview = (why: string): PromotionDecision => ({
    ...base,
    decision: "ask",
    check: "review-needed",
    reason: `${why}; ${target} requires review, so a reviewer (a user-sourced member of ${target} who does not own the item) must approve`,
    policy_id: promotionRuleId(policy, "review"),
  });
  if (met === null) {
    if (reviewable && targetReview) return askReview(missing);
    return deny("no-evidence", `not promoted: ${missing}`, PROMOTE_NO_EVIDENCE_ID);
  }
  if (targetReview && !evidence.review) return askReview(`evidence met (${met})`);

  const what =
    transition === "in-place"
      ? `item ${item.id} becomes active in ${target}`
      : `item ${item.id} (${item.class} in ${item.scope}) becomes a new ${promoted.class} version in ${target}, provenance ${promoted.provenance.kind}`;
  const why =
    met === "confirmed"
      ? `${counted.count} confirmations by distinct actors with a user, document or tool source (${counted.actors.join(", ")}) reach the ${k} required`
      : met === "validated"
        ? `the validation record ${evidence.validation?.k} of ${evidence.validation?.n} meets ${policy.promotion.procedural.replay_k} of ${policy.promotion.procedural.replay_n}`
        : `reviewed with ${counted.count} confirmation${counted.count === 1 ? "" : "s"}`;
  const rule =
    met === "confirmed" ? "episodic-to-semantic" : met === "validated" ? "procedural" : "review";
  return {
    ...base,
    decision: "allow",
    check: met,
    reason: `${what}: ${why}${approved}; ${targetReview ? `${scopeLevel(target)} scope requires review, which ${actor.id} gave` : write.reason}`,
    policy_id: promotionRuleId(policy, rule),
    transition,
    promoted,
  };
}
