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
//   engram/write/membership         the writer is not a member of the item's scope (decision D4)
//   engram/write/version            a rewrite lowers the version or changes the owner (D4)
//   engram/write/grant              a grant the gate refuses (D4, ADR 0021, ADR 0004)
//   engram/write/source-isolation   model and compaction content stays in person scope (ADR 0004, 0007)
//   engram/write/retired-content    a model, compaction or tool write restates content retired in its scope (ADR 0025)
//   engram/write/default-deny       no write rule for the item's scope level (D6)
//   engram/write/schema             the item failed the schema
//   engram/write/store-failure      the store failed after the gate allowed the write (D6)
//   engram/read/default-deny        no read matrix row for the actor's level (D6)
//   engram/read/status              only active items are read
//   engram/read/validity            the validity window at the read time (ADR 0005)
//   engram/read/ttl                 past its ttl: a lifecycle exclusion before any sweep (ADR 0025)
import type { Actor } from "../actor.ts";
import { contentHash } from "../content-hash.ts";
import type { Grant, MemoryItem, Policy, ScopeLevel } from "../schema.ts";
import { compareTimestamps } from "../time.ts";
import { itemExpiry } from "./retention.ts";

export const WRITE_MEMBERSHIP_ID = "engram/write/membership";
export const WRITE_VERSION_ID = "engram/write/version";
export const WRITE_GRANT_ID = "engram/write/grant";
export const SOURCE_ISOLATION_ID = "engram/write/source-isolation";
export const WRITE_DEFAULT_DENY_ID = "engram/write/default-deny";
export const SCHEMA_ID = "engram/write/schema";
export const STORE_FAILURE_ID = "engram/write/store-failure";
export const READ_DEFAULT_DENY_ID = "engram/read/default-deny";
export const READ_STATUS_ID = "engram/read/status";
export const READ_VALIDITY_ID = "engram/read/validity";
export const READ_TTL_ID = "engram/read/ttl";
export const RETIRED_CONTENT_ID = "engram/write/retired-content";

/** Sources that are untrusted by default and cannot leave person scope at write (ADR 0004, 0007). */
const UNTRUSTED_SOURCES: ReadonlySet<string> = new Set(["model", "compaction"]);

/**
 * Sources that may not restate content retired in the scope (ADR 0025,
 * Bemula's relearning): what a model, a compaction or a tool produces again
 * is not a person re-establishing it. A user, document or import write may.
 */
const RELEARNING_SOURCES: ReadonlySet<string> = new Set(["model", "compaction", "tool"]);

export function scopeLevel(scope: string): ScopeLevel {
  return (scope === "org" ? "org" : scope.split(":")[0]) as ScopeLevel;
}

/** A grant's `to` matches an actor id exactly, or by prefix when it ends in `*`. */
export function grantMatches(pattern: string, actorId: string): boolean {
  return pattern.endsWith("*") ? actorId.startsWith(pattern.slice(0, -1)) : pattern === actorId;
}

/** valid_from <= at < valid_to (open when valid_to is null), compared as instants at full precision. */
export function withinValidity(item: MemoryItem, at: string): boolean {
  return (
    compareTimestamps(item.valid_from, at) <= 0 &&
    (item.valid_to === null || compareTimestamps(item.valid_to, at) > 0)
  );
}

/** Why the gate refuses `grant` on `item`, or null when it accepts it (decision D4). */
export function grantProblem(grant: Grant, kind: MemoryItem["provenance"]["kind"]): string | null {
  if (UNTRUSTED_SOURCES.has(kind))
    return `${kind} content carries no grants (ADR 0004); it stays with its owner`;
  // A principal with no `*`, or `<kind>:<non-empty prefix>*` with the only `*` last.
  const star = grant.to.indexOf("*");
  const colon = grant.to.indexOf(":");
  const wellFormed = star === -1 || (star === grant.to.length - 1 && colon > 0 && colon < star - 1);
  if (!wellFormed)
    return `grant to ${grant.to} is too wide; a pattern names a kind and a non-empty prefix, such as agent:claude-code/*`;
  if (grant.class === undefined) return `grant to ${grant.to} names no class (ADR 0021)`;
  if (grant.expires === undefined) return `grant to ${grant.to} has no expiry (ADR 0021)`;
  return null;
}

export type WriteCheck =
  | "admit"
  | "review"
  | "not-member"
  | "version"
  | "grant"
  | "no-rule"
  | "forbidden-class"
  | "source-not-allowed"
  | "source-isolation"
  | "below-floor"
  | "retired-content";

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
 * the actor is a member of the item's scope (and, for a rewrite, of the scope
 * the item has now); a rewrite keeps the owner and does not lower the
 * version; every grant is one the gate accepts; a rule exists for the item's
 * scope level (none means deny); the class is not forbidden; the source kind
 * is listed; model and compaction sources stay in person scope; confidence is
 * at least the floor; a model, compaction or tool source does not restate
 * content retired in the scope (ADR 0025). A passing write lands as a
 * candidate when the rule requires review, otherwise with its own status.
 * `existing` is the projected item of the same id, when there is one;
 * `retired` maps the normalised content hash (content-hash.ts) of every
 * retired item in the item's scope to that item's id. The provenance judged
 * is the item's; the plane sets it from the actor's source first
 * (plane/write.ts).
 */
export function evaluateWrite(
  policy: Policy,
  actor: Actor,
  item: MemoryItem,
  existing: MemoryItem | undefined,
  retired: ReadonlyMap<string, string>,
): WriteDecision {
  const level = scopeLevel(item.scope);
  const policy_id = `${policy.id}/write/${level}`;
  const deny = (check: WriteCheck, reason: string, id = policy_id): WriteDecision => ({
    decision: "deny",
    status: null,
    check,
    reason,
    policy_id: id,
  });

  if (!actor.memberships.includes(item.scope))
    return deny(
      "not-member",
      `${actor.id} is not a member of ${item.scope}; grants let others read, never write`,
      WRITE_MEMBERSHIP_ID,
    );
  if (existing) {
    // A writer who cannot read the projected item's scope learns only that its
    // id is taken, never its scope, owner or version (finding N3): the reason
    // is returned to the caller, and the pi extension shows it to the model.
    // A non-member of that scope can never read it by scope.
    const opaque = readableScope(policy, actor, existing.scope)
      ? undefined
      : `${actor.id} cannot write item ${item.id}: the item id is held by an item you cannot access`;
    if (!actor.memberships.includes(existing.scope))
      return deny(
        "not-member",
        `${actor.id} cannot write item ${item.id}: the item id is held by an item you cannot access`,
        WRITE_MEMBERSHIP_ID,
      );
    if (item.owner !== existing.owner)
      return deny(
        "version",
        opaque ??
          `a rewrite of ${item.id} changes its owner from ${existing.owner} to ${item.owner}`,
        WRITE_VERSION_ID,
      );
    if (item.version < existing.version)
      return deny(
        "version",
        opaque ??
          `a rewrite of ${item.id} at version ${item.version} is below the projected version ${existing.version}`,
        WRITE_VERSION_ID,
      );
  }
  const kind = item.provenance.kind;
  for (const [i, grant] of item.grants.entries()) {
    const problem = grantProblem(grant, kind);
    if (problem) return deny("grant", `grants[${i}]: ${problem}`, WRITE_GRANT_ID);
  }

  const rule = policy.write.find((r) => r.scope === level);
  if (!rule)
    return deny(
      "no-rule",
      `policy ${policy.id} has no write rule for ${level}; denied by default`,
      WRITE_DEFAULT_DENY_ID,
    );
  if (rule.forbidden_classes.includes(item.class))
    return deny("forbidden-class", `${item.class} items are forbidden in ${level} scope`);
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
  if (RELEARNING_SOURCES.has(kind) && retired.size > 0) {
    const was = retired.get(contentHash(item.content));
    // The retired item is named only to a writer who may read its scope
    // (as finding N3 keeps what a writer cannot read out of the reason).
    if (was !== undefined)
      return deny(
        "retired-content",
        `the content restates ${readableScope(policy, actor, item.scope) ? `item ${was}` : "an item"}, retired in ${item.scope}; a ${kind} source cannot bring it back, a user, document or import source can`,
        RETIRED_CONTENT_ID,
      );
  }
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

export type ReadCheck =
  | "scope"
  | "grant"
  | "excluded"
  | "not-active"
  | "expired"
  | "outside-validity";

export interface ReadDecision {
  admitted: boolean;
  check: ReadCheck;
  reason: string;
  /** The rule that admitted the item, or the one that excluded it. */
  policy_id: string;
  /** The grants that admitted the item, as `grants[<index>]:<to>`; empty unless check is grant. */
  grants_used: string[];
}

/** The read matrix row's rule id for the actor's level, or the default deny when there is none. */
export function readRuleId(policy: Policy, actor: Actor): string {
  return policy.read.matrix.some((r) => r.reader === actor.level)
    ? `${policy.id}/read/${actor.level}`
    : READ_DEFAULT_DENY_ID;
}

/** The actor is a member of `scope` and the read matrix lets its level read that scope's level. */
export function readableScope(policy: Policy, actor: Actor, scope: string): boolean {
  const mayRead = policy.read.matrix.find((r) => r.reader === actor.level)?.may_read ?? [];
  return actor.memberships.includes(scope) && mayRead.includes(scopeLevel(scope));
}

/**
 * Could the actor reach `item` at all: through a readable scope, or through a
 * grant on it whose `to` matches the actor, when the policy honours grants.
 * What the actor cannot reach is never a candidate of its reads, so its
 * results reveal nothing about it (decision D5). A matching grant that has
 * expired or names another class still makes the item a candidate, which the
 * read filter then removes and `filtered` counts, as D5 allows; it never
 * widens what the store is searched for, since the store is searched only in
 * the reader's readable member scopes (plane/read.ts, finding N1).
 */
export function reachable(policy: Policy, actor: Actor, item: MemoryItem): boolean {
  return (
    readableScope(policy, actor, item.scope) ||
    (policy.read.honour_grants && item.grants.some((g) => grantMatches(g.to, actor.id)))
  );
}

/**
 * The read filter for one item. Only active items are read, and only before
 * their ttl runs out (ADR 0025: lifecycle is an admissibility axis, so an
 * expired item is excluded before any sweep retires it). Access is by
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
  const matrixId = readRuleId(policy, actor);
  const result = (
    admitted: boolean,
    check: ReadCheck,
    reason: string,
    policy_id: string,
    grants_used: string[] = [],
  ): ReadDecision => ({ admitted, check, reason, policy_id, grants_used });

  if (item.status !== "active")
    return result(false, "not-active", `item is ${item.status}, not active`, READ_STATUS_ID);
  const expiry = itemExpiry(policy, item);
  if (expiry !== null && compareTimestamps(expiry.at, at) <= 0)
    return result(
      false,
      "expired",
      `past its ttl: expired at ${expiry.at} (${expiry.policy_id})`,
      READ_TTL_ID,
    );

  const member = actor.memberships.includes(item.scope);
  let access: ReadDecision;
  if (readableScope(policy, actor, item.scope)) {
    access = result(
      true,
      "scope",
      `${actor.id} is a member of ${item.scope} and ${actor.level} may read ${level}`,
      matrixId,
    );
  } else {
    const used = policy.read.honour_grants
      ? item.grants.flatMap((g, i) =>
          grantMatches(g.to, actor.id) &&
          (g.class === undefined || g.class === item.class) &&
          (g.expires === undefined || compareTimestamps(g.expires, at) > 0)
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
            matrixId === READ_DEFAULT_DENY_ID
              ? `policy ${policy.id} has no read matrix row for ${actor.level}; denied by default, and no live grant matches ${actor.id}`
              : member
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
