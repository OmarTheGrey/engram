// The policy evaluator (cards E2.2 and E2.3, ADR 0006, ADR 0007): pure,
// deterministic functions from a typed Policy and their inputs to a decision
// with a reason and the id of the rule that decided. No clock, no store, no
// model. The Plane calls them on the write and read paths; the simulator can
// call them on a recorded workload under another policy.
//
// Rule ids:
//   <policy id>/write/<level>       the write rule for the item's scope level
//   <policy id>/read/<level>        the read matrix row for the actor's level
//   <policy id>/read/grants         admission through a grant on the item
//   engram/write/source-isolation   model and compaction content stays in person scope (ADR 0004, 0007)
//   engram/write/schema             the item failed the schema
//   engram/read/status              only active items are read
//   engram/read/validity            the validity window at the read time (ADR 0005)
import type { Actor } from "../plane.ts";
import type { MemoryItem, Policy, ScopeLevel } from "../schema.ts";

export const SOURCE_ISOLATION_ID = "engram/write/source-isolation";
export const SCHEMA_ID = "engram/write/schema";
export const READ_STATUS_ID = "engram/read/status";
export const READ_VALIDITY_ID = "engram/read/validity";

/** Sources that are untrusted by default and cannot leave person scope at write (ADR 0004, 0007). */
const UNTRUSTED_SOURCES: ReadonlySet<string> = new Set(["model", "compaction"]);

export function scopeLevel(scope: string): ScopeLevel {
  return (scope === "org" ? "org" : scope.split(":")[0]) as ScopeLevel;
}

/** A grant's `to` matches an actor id exactly, or by prefix when it ends in `*`. */
export function grantMatches(pattern: string, actorId: string): boolean {
  return pattern.endsWith("*") ? actorId.startsWith(pattern.slice(0, -1)) : pattern === actorId;
}

/** valid_from <= at < valid_to (open when valid_to is null), compared as instants. */
export function withinValidity(item: MemoryItem, at: string): boolean {
  const t = Date.parse(at);
  return (
    Date.parse(item.valid_from) <= t && (item.valid_to === null || Date.parse(item.valid_to) > t)
  );
}

export type WriteCheck =
  | "admit"
  | "review"
  | "no-rule"
  | "forbidden-class"
  | "source-not-allowed"
  | "source-isolation"
  | "below-floor";

export interface WriteDecision {
  /**
   * A write that needs review is allowed: it lands as a candidate and reads
   * skip it until it is promoted. "ask" is left to the promotion gate.
   */
  decision: "allow" | "deny";
  /** The status the item lands with; null on deny. */
  status: MemoryItem["status"] | null;
  /** Which check decided; the reason says the same in words. */
  check: WriteCheck;
  reason: string;
  policy_id: string;
}

/**
 * The write gate. Checks run in a fixed order and the first failure decides:
 * a rule exists for the item's scope level (none means deny), the class is not
 * forbidden, the source kind is listed, model and compaction sources stay in
 * person scope, confidence is at least the floor. A passing write lands as a
 * candidate when the rule requires review, otherwise with its own status.
 */
export function evaluateWrite(policy: Policy, item: MemoryItem): WriteDecision {
  const level = scopeLevel(item.scope);
  const policy_id = `${policy.id}/write/${level}`;
  const deny = (check: WriteCheck, reason: string, id = policy_id): WriteDecision => ({
    decision: "deny",
    status: null,
    check,
    reason,
    policy_id: id,
  });
  const rule = policy.write.find((r) => r.scope === level);
  if (!rule)
    return deny("no-rule", `policy ${policy.id} has no write rule for ${level}; denied by default`);
  if (rule.forbidden_classes.includes(item.class))
    return deny("forbidden-class", `${item.class} items are forbidden in ${level} scope`);
  const kind = item.provenance.kind;
  if (!rule.allowed_sources.includes(kind))
    return deny("source-not-allowed", `source ${kind} is not allowed in ${level} scope`);
  if (UNTRUSTED_SOURCES.has(kind) && level !== "person")
    return deny(
      "source-isolation",
      `${kind} content cannot leave person scope without a gate pass; it targets ${item.scope}`,
      SOURCE_ISOLATION_ID,
    );
  if (item.confidence < rule.confidence_floor)
    return deny(
      "below-floor",
      `confidence ${item.confidence} is below the ${level} floor ${rule.confidence_floor}`,
    );
  if (rule.requires_review)
    return {
      decision: "allow",
      status: item.status === "active" ? "candidate" : item.status,
      check: "review",
      reason: `${level} scope requires review; stored as a candidate until promoted`,
      policy_id,
    };
  return {
    decision: "allow",
    status: item.status,
    check: "admit",
    reason: `${item.class} item from source ${kind} passes the ${level} write rule`,
    policy_id,
  };
}

export type ReadCheck = "scope" | "grant" | "excluded" | "not-active" | "outside-validity";

export interface ReadDecision {
  admitted: boolean;
  check: ReadCheck;
  reason: string;
  /** The rule that admitted the item, or the one that excluded it. */
  policy_id: string;
  /** The grants that admitted the item, as `grants[<index>]:<to>`; empty unless check is grant. */
  grants_used: string[];
}

/**
 * The read filter for one item. Only active items are read. Access is by
 * scope (the actor is a member of the item's scope and the read matrix lets
 * the actor's level read that scope's level) or, when the policy honours
 * grants, by every live grant on the item whose `to` matches the actor, whose
 * class is absent or the item's, and whose expiry is absent or after `at`.
 * An admitted item must also be inside its validity window at `at`.
 */
export function evaluateRead(
  policy: Policy,
  actor: Actor,
  item: MemoryItem,
  at: string,
): ReadDecision {
  const level = scopeLevel(item.scope);
  const matrixId = `${policy.id}/read/${actor.level}`;
  const result = (
    admitted: boolean,
    check: ReadCheck,
    reason: string,
    policy_id: string,
    grants_used: string[] = [],
  ): ReadDecision => ({ admitted, check, reason, policy_id, grants_used });

  if (item.status !== "active")
    return result(false, "not-active", `item is ${item.status}, not active`, READ_STATUS_ID);

  const mayRead = policy.read.matrix.find((r) => r.reader === actor.level)?.may_read ?? [];
  const member = actor.memberships.includes(item.scope);
  const levelOk = mayRead.includes(level);
  let access: ReadDecision;
  if (member && levelOk) {
    access = result(
      true,
      "scope",
      `${actor.id} is a member of ${item.scope} and ${actor.level} may read ${level}`,
      matrixId,
    );
  } else {
    const t = Date.parse(at);
    const used = policy.read.honour_grants
      ? item.grants.flatMap((g, i) =>
          grantMatches(g.to, actor.id) &&
          (g.class === undefined || g.class === item.class) &&
          (g.expires === undefined || Date.parse(g.expires) > t)
            ? [`grants[${i}]:${g.to}`]
            : [],
        )
      : [];
    access =
      used.length > 0
        ? result(true, "grant", `admitted by ${used.join(", ")}`, `${policy.id}/read/grants`, used)
        : result(
            false,
            "excluded",
            member
              ? `the read matrix does not let ${actor.level} read ${level} and no live grant matches ${actor.id}`
              : `${actor.id} is not a member of ${item.scope} and no live grant matches it`,
            matrixId,
          );
  }
  if (!access.admitted) return access;
  if (!withinValidity(item, at))
    return result(
      false,
      "outside-validity",
      `outside its validity window [${item.valid_from}, ${item.valid_to ?? "open"}) at ${at}`,
      READ_VALIDITY_ID,
    );
  return access;
}
