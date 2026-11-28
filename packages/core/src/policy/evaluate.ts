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
//   engram/write/grant              a grant the gate refuses (D4, ADR 0021, ADR 0004), or one naming another class than the item's
//   engram/grant/owner              a rewrite changing the grants by anyone but the owner (ADR 0034, review I1)
//   engram/grant/source             a rewrite changing the grants by an actor neither user- nor import-sourced
//   engram/grant/expired            a grant added after it expired (ADR 0034)
//   engram/grant/unchanged          a grant the item already carries, added again
//   engram/write/grant-expiry-cap   a grant expiring more than 365 days after the write, under grants.expiry_cap (ADR 0034, card E2.21)
//   engram/write/source-isolation   model and compaction content stays in person scope (ADR 0004, 0007)
//   engram/write/retired-content    a model, compaction or tool write restates content retired in its scope (ADR 0025)
//   engram/write/default-deny       no write rule for the item's scope level (D6)
//   engram/write/downgrade          a less trusted source rewrites or retires a more trusted item (ADR 0040, policy/trust.ts)
//   engram/write/injection-screen   held as a candidate by the injection screen (ADR 0039, policy/injection-screen.ts)
//   engram/write/schema             the item failed the schema
//   engram/write/store-failure      the store failed after the gate allowed the write (D6)
//   engram/read/default-deny        no read matrix row for the actor's level (D6)
//   engram/read/status              only active items are read
//   engram/read/validity            the validity window at the read time (ADR 0005)
//   engram/read/ttl                 past its ttl: a lifecycle exclusion before any sweep (ADR 0025)
//   engram/write/secret, /pii, /content-size, /guard-failure   the content guards (ADR 0039, policy/secrets.ts)
import type { Actor } from "../actor.ts";
import { contentHash } from "../content-hash.ts";
import { canonicalJson } from "../model.ts";
import type { Grant, MemoryItem, Policy, ScopeLevel } from "../schema.ts";
import { addSeconds, compareTimestamps } from "../time.ts";
import { INJECTION_SCREEN_ID, injectionHold } from "./injection-screen.ts";
import { itemExpiry } from "./retention.ts";
import { contentGuard } from "./secrets.ts";
import { DOWNGRADE_ID, downgradeProblem } from "./trust.ts";

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
export const GRANT_OWNER_ID = "engram/grant/owner";
export const GRANT_SOURCE_ID = "engram/grant/source";
export const GRANT_EXPIRED_ID = "engram/grant/expired";
export const GRANT_UNCHANGED_ID = "engram/grant/unchanged";
/** A grant expiring past the cap, under grants.expiry_cap (ADR 0034, decision 3; card E2.21). */
export const GRANT_EXPIRY_CAP_ID = "engram/write/grant-expiry-cap";
/** The cap: 365 days of 86,400 seconds after the write's event time, no calendar year, no leap day. */
export const GRANT_EXPIRY_CAP_SECONDS = 31_536_000;

/**
 * Whether the policy turns ADR 0034's cap and first-write rule on
 * (`grants.expiry_cap`, card E2.21). Absent or `off`, the gate decides as it
 * did before the option: no registered preset sets it.
 */
export function expiryCapOn(policy: Policy): boolean {
  return policy.grants?.expiry_cap === "on";
}
/** A rewrite that moves an item to another scope by anyone but its owner (card RV7, RV-CORE-2). */
export const WRITE_MOVE_ID = "engram/write/move";

/**
 * Sources that are untrusted by default and cannot leave person scope at
 * write (ADR 0004, 0007): what a model or a compaction derived, and what an
 * outsider sent (`external`, schema version 1), the least trusted of all.
 */
const UNTRUSTED_SOURCES: ReadonlySet<string> = new Set(["model", "compaction", "external"]);

/**
 * Sources that may not restate content retired in the scope (ADR 0025,
 * Bemula's relearning): what a model, a compaction, a tool or an outsider
 * produces again is not a person re-establishing it. A user, document or
 * import write may.
 */
const RELEARNING_SOURCES: ReadonlySet<string> = new Set([
  "model",
  "compaction",
  "tool",
  "external",
]);

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

/** Two grants are one when every field is equal, the expiry compared as an instant. */
export function sameGrant(a: Grant, b: Grant): boolean {
  const expiry =
    a.expires === undefined || b.expires === undefined
      ? a.expires === b.expires
      : compareTimestamps(a.expires, b.expires) === 0;
  return a.to === b.to && a.class === b.class && a.mode === b.mode && expiry;
}

/** The same grants, each as often, in any order. */
export function sameGrants(a: readonly Grant[], b: readonly Grant[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...b];
  for (const g of a) {
    const k = left.findIndex((h) => sameGrant(g, h));
    if (k === -1) return false;
    left.splice(k, 1);
  }
  return true;
}

/** `item` is `existing` with only its status and version changed: the promotion gate's in-place transition. */
function onlyStatusAndVersion(item: MemoryItem, existing: MemoryItem): boolean {
  const rest = ({ status: _s, version: _v, ...other }: MemoryItem) => canonicalJson(other);
  return rest(item) === rest(existing);
}

/** A grant as a reason names it. */
export function grantText(g: Grant): string {
  return `grant to ${g.to} (class ${g.class ?? "any"}, mode ${g.mode}, expires ${g.expires ?? "never"})`;
}

/**
 * Why a grant being added to `item` is refused, and under which rule, or
 * null: the one check both paths that add a grant run (Plane.write and
 * Plane.changeGrants; review finding M1 of PR #44). The write gate's grant
 * rule (grantProblem, decision D4); a class other than the item's, which
 * could never admit a read; with `at`, an expiry at or before it; with `at`
 * and `cap` (grants.expiry_cap on, card E2.21), an expiry more than 365 days
 * after it, refused and never clamped (ADR 0034, decision 3; exactly 365
 * days lands); and a grant `alongside` already holds.
 */
export function grantDefect(
  grant: Grant,
  item: MemoryItem,
  alongside: readonly Grant[],
  at?: string,
  cap = false,
): { problem: string; policy_id: string } | null {
  const problem = grantProblem(grant, item.provenance.kind);
  if (problem) return { problem, policy_id: WRITE_GRANT_ID };
  if (grant.class !== undefined && grant.class !== item.class)
    return {
      problem: `${grantText(grant)} names class ${grant.class}, but the item is ${item.class}: it would never admit a read`,
      policy_id: WRITE_GRANT_ID,
    };
  if (at !== undefined && grant.expires !== undefined && compareTimestamps(grant.expires, at) <= 0)
    return {
      problem: `the ${grantText(grant)} has expired by ${at}; it would never admit a read`,
      policy_id: GRANT_EXPIRED_ID,
    };
  const limit = cap && at !== undefined ? addSeconds(at, GRANT_EXPIRY_CAP_SECONDS) : null;
  if (limit !== null && grant.expires !== undefined && compareTimestamps(grant.expires, limit) > 0)
    return {
      problem: `the ${grantText(grant)} expires after ${limit}, the limit of 365 days (31,536,000 seconds) after this change at ${at}; it is refused, not shortened: give it an expiry at or before ${limit} and renew it then`,
      policy_id: GRANT_EXPIRY_CAP_ID,
    };
  if (alongside.some((h) => sameGrant(grant, h)))
    return {
      problem: `item ${item.id} already carries the ${grantText(grant)}`,
      policy_id: GRANT_UNCHANGED_ID,
    };
  return null;
}

export type WriteCheck =
  | "admit"
  | "downgrade"
  | "review"
  | "not-member"
  | "version"
  | "grant"
  | "no-rule"
  | "forbidden-class"
  | "source-not-allowed"
  | "source-isolation"
  | "below-floor"
  | "retired-content"
  | "content-guard"
  | "move";

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
 * (plane/write.ts), or floors it (trust.unattested_floor). After the grant
 * checks, with trust.protect_trusted on, a rewrite or retire of an active
 * item at a less trusted kind than its own is denied (`engram/write/downgrade`,
 * policy/trust.ts) unless its owner acts as user (ADR 0040).
 *
 * Grants (ADR 0034, review findings I1 and M1 of PR #44): a rewrite whose
 * grants differ from the projected item's, or that changes the class of an
 * item carrying grants (verification finding V-4), is a grant change, so only the
 * owner may make it, user-sourced, or import-sourced (the owner's own store
 * record adopted); every grant it adds passes grantDefect at `at`, as a
 * grant change's would. Every grant, kept or added, passes the write gate's
 * grant rule (D4), and a first write or a grant change carries each grant
 * once; a first write's grants are judged no further (see the loop), unless
 * grants.expiry_cap is on (card E2.21): then a first write is held to the
 * whole of grantDefect, and every grant a write adds to the cap of 365 days
 * after `at` (`engram/write/grant-expiry-cap`).
 *
 * `options.promotion` marks a call by the promotion gate (policy/promotion.ts)
 * for its in-place transition or its new version: the cap and the first-write
 * rule never judge either (ADR 0034, decision 6), and the owner rule's
 * exemption below holds only for an in-place transition that changes nothing
 * but the status and the version.
 *
 * The owner's rules (card RV7, core review findings RV-CORE-1 and 2; the
 * amendments of ADRs 0006 and 0034): a rewrite that moves an item to another
 * scope is its owner's only (`engram/write/move`), so no co-holder takes an
 * item out of the owner's reach; and a rewrite of an item carrying grants,
 * live or expired, is its owner's only, whatever it changes
 * (`engram/grant/owner`), since a grant reads as the owner's consent to what
 * the item says. The one exception is the promotion gate's in-place
 * transition (`promotion`), which a reviewer who is not the owner makes and
 * which changes nothing but the status and the version; it is exempt only
 * when the item is exactly that.
 */
export function evaluateWrite(
  policy: Policy,
  actor: Actor,
  item: MemoryItem,
  existing: MemoryItem | undefined,
  retired: ReadonlyMap<string, string>,
  at?: string,
  options: { promotion?: boolean } = {},
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
    // Only the owner moves an item (RV-CORE-2): membership of both scopes is
    // not enough, or a co-holder could take the owner's item out of the
    // owner's reach, and with it the owner's control of its grants.
    // A writer who may not read the item's scope gets the opaque refusal
    // under the membership rule, whose id names no check (RV7-R5).
    if (item.scope !== existing.scope && actor.id !== existing.owner)
      return opaque
        ? deny("not-member", opaque, WRITE_MEMBERSHIP_ID)
        : deny(
            "move",
            `a rewrite of ${item.id} moves it from ${existing.scope} to ${item.scope}: only its owner ${existing.owner} may move it`,
            WRITE_MOVE_ID,
          );
  }
  const kind = item.provenance.kind;
  const prior = existing?.grants ?? [];
  // The cap and the first-write rule (grants.expiry_cap, card E2.21); never
  // for the promotion gate's new version or in-place transition (decision 6).
  const capped = expiryCapOn(policy) && !options.promotion;
  // A grant admits a read only of its own class, so a class change of an item
  // carrying grants switches what they admit: it is a grant change too
  // (verification finding V-4 of PR #44).
  const reclasses =
    existing !== undefined &&
    item.class !== existing.class &&
    (item.grants.length > 0 || prior.length > 0);
  const changesGrants = existing !== undefined && (reclasses || !sameGrants(item.grants, prior));
  if (changesGrants && existing) {
    // The membership check above passed, so the actor may learn the owner
    // only if it may read the item's scope (as finding N3 keeps it).
    const named = readableScope(policy, actor, existing.scope) ? ` ${existing.owner}` : "";
    const what = reclasses
      ? `changes its class from ${existing.class} to ${item.class} while it carries grants, which changes what they admit`
      : "changes its grants";
    if (actor.source !== "user" && actor.source !== "import")
      return deny(
        "grant",
        `a rewrite of ${item.id} ${what}, which is its owner's consent, given by the person: ${actor.id} is ${actor.source === undefined ? "not user-sourced" : `${actor.source}-sourced`}`,
        GRANT_SOURCE_ID,
      );
    if (actor.id !== existing.owner)
      return deny(
        "grant",
        `a rewrite of ${item.id} ${what}: only its owner${named} may change the grants of ${item.id}`,
        GRANT_OWNER_ID,
      );
  } else if (
    existing &&
    prior.length > 0 &&
    actor.id !== existing.owner &&
    !(options.promotion && onlyStatusAndVersion(item, existing))
  ) {
    // A grant is the owner's consent to what the item says (RV-CORE-1): a
    // rewrite keeping the grants is the owner's too, or a grantee would read
    // another member's text under the owner's name. A writer who may not
    // read the item's scope learns only that the id is taken (RV7-R5).
    if (!readableScope(policy, actor, existing.scope))
      return deny(
        "not-member",
        `${actor.id} cannot write item ${item.id}: the item id is held by an item you cannot access`,
        WRITE_MEMBERSHIP_ID,
      );
    return deny(
      "grant",
      `a rewrite of ${item.id} keeps its grants, which are its owner's consent to what it says: only its owner ${existing.owner} may rewrite an item carrying grants`,
      GRANT_OWNER_ID,
    );
  }
  for (const [i, grant] of item.grants.entries()) {
    const problem = grantProblem(grant, kind);
    if (problem) return deny("grant", `grants[${i}]: ${problem}`, WRITE_GRANT_ID);
    const earlier = item.grants.slice(0, i);
    // A first write, and a rewrite that changes the grants, carry each grant
    // once (review M1 of PR #44); a rewrite keeping the grants as they are
    // is judged as before.
    if ((existing === undefined || changesGrants) && earlier.some((h) => sameGrant(grant, h)))
      return deny(
        "grant",
        `grants[${i}]: the ${grantText(grant)} is already among the item's grants`,
        GRANT_UNCHANGED_ID,
      );
    // Only a grant a rewrite adds is judged further: keeping one the item
    // already carries is no grant change. With grants.expiry_cap absent or
    // off, a first write keeps the write gate's grant rule alone, as before
    // the option (M1 of PR #44): the read filter's tests write a grant of
    // another class or an expired one on a first write under testPolicy().
    // With it on (ADR 0034, decisions 3 and 6; card E2.21), a first write is
    // held to the whole of grantDefect, the cap included, and so is every
    // grant a rewrite adds; a promotion's new version is exempt (decision 6:
    // it only keeps grants an earlier write held to them).
    // A class change judges every grant it keeps against the new class: one
    // naming another class would never admit a read (V-4).
    const kept = prior.some((h) => sameGrant(grant, h));
    if (reclasses && kept && grant.class !== undefined && grant.class !== item.class)
      return deny(
        "grant",
        `grants[${i}]: ${grantText(grant)} names class ${grant.class}, but the item becomes ${item.class}: it would never admit a read; remove it first`,
        WRITE_GRANT_ID,
      );
    const firstWriteRule = capped && existing === undefined;
    if (!firstWriteRule && (!changesGrants || kept)) continue;
    const defect = grantDefect(grant, item, earlier, at, capped);
    if (defect) return deny("grant", `grants[${i}]: ${defect.problem}`, defect.policy_id);
  }
  // Trust floors (card E2.11, ADR 0040): off unless the policy's trust block
  // turns protect_trusted on. A writer who may not read the item's scope
  // learns only that its id is taken (finding N3).
  const downgrade = downgradeProblem(policy, actor, item, existing);
  if (downgrade !== null && existing)
    return readableScope(policy, actor, existing.scope)
      ? deny("downgrade", downgrade, DOWNGRADE_ID)
      : deny(
          "not-member",
          `${actor.id} cannot write item ${item.id}: the item id is held by an item you cannot access`,
          WRITE_MEMBERSHIP_ID,
        );

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
  // The content guards (card E2.9, ADR 0039): off unless the policy has the block.
  const guarded = contentGuard(policy, item, existing);
  if (guarded) return guarded;
  // The injection screen (card E2.10, ADR 0039): off unless the policy's
  // content_guards turn it on; a hold is a review, so a person promotes it.
  const screened = injectionHold(policy, item);
  if (screened !== null)
    return {
      decision: "allow",
      status: item.status === "active" ? "candidate" : item.status,
      check: "review",
      reason: screened,
      policy_id: INJECTION_SCREEN_ID,
    };
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
 * The grants on `item` that let the actor read it at `at`, as
 * `grants[<index>]:<to>`: the policy honours grants, the grant's `to` matches
 * the actor, its class is absent or the item's, and its expiry is absent or
 * after `at`. Empty when none does.
 */
export function liveGrants(policy: Policy, actor: Actor, item: MemoryItem, at: string): string[] {
  if (!policy.read.honour_grants) return [];
  return item.grants.flatMap((g, i) =>
    grantMatches(g.to, actor.id) &&
    (g.class === undefined || g.class === item.class) &&
    (g.expires === undefined || compareTimestamps(g.expires, at) > 0)
      ? [`grants[${i}]:${g.to}`]
      : [],
  );
}

/**
 * Could the actor read `item` at `at`, whatever its status or validity: by a
 * readable scope, or by a live grant (liveGrants). Unlike reachable, an
 * expired grant or one naming another class does not count. Plane.lint
 * (card L1) uses it for the items a finding may name or describe, so a lint
 * says nothing of an item the read filter would never admit on access.
 */
export function readableAt(policy: Policy, actor: Actor, item: MemoryItem, at: string): boolean {
  return readableScope(policy, actor, item.scope) || liveGrants(policy, actor, item, at).length > 0;
}

/**
 * The read filter for one item. Only active items are read, and only before
 * their ttl runs out (ADR 0025: lifecycle is an admissibility axis, so an
 * expired item is excluded before any sweep retires it). Access is by
 * scope (the actor is a member of the item's scope and the read matrix lets
 * the actor's level read that scope's level) or, when the policy honours
 * grants, by every live grant on the item whose `to` matches the actor, whose
 * class is absent or the item's, and whose expiry is absent or after `at`.
 * An admitted item must also be inside its validity window at `validAt`,
 * which is `at` unless the reader asked what was true at another time (card
 * RV5, finding RV-SRF-2): status, ttl and grants are always judged at `at`,
 * the read's own time, so a time the reader names cannot bring back what a
 * grant's expiry or a ttl has closed.
 */
export function evaluateRead(
  policy: Policy,
  actor: Actor,
  item: MemoryItem,
  at: string,
  validAt: string = at,
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
    const used = liveGrants(policy, actor, item, at);
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
  if (!withinValidity(item, validAt))
    return result(
      false,
      "outside-validity",
      `outside its validity window [${item.valid_from}, ${item.valid_to ?? "open"}) at ${validAt}`,
      READ_VALIDITY_ID,
    );
  return access;
}
