// The twin dogfood's violation report (card E9.5, docs/dogfood.md): a
// member's own event log, replayed on the member's own machine, judged by the
// invariants' oracle (./oracle.ts), never by the evaluator, and reduced to
// aggregate counts. Rule 12 of AGENTS.md: dogfood content never leaves the
// member's machine, so the report holds counts, fixed keys, rule ids from a
// fixed list, the shape of the declared actor and the policy's hash; never
// content, an item id, a principal or a scope. `details` names the
// violations for the member alone (printed to stderr by
// scripts/dogfood-report.ts with --detail, never sent).
//
// A violation is either:
//
// - a read that returned an item the reader could not read at that time: the
//   item, as the allowed events before the read leave it in the oracle's own
//   replay, is missing, not active, not `readable` by the reader at the
//   read's time (invariant 1), or outside its validity window
//   (`withinValidity`, review finding E95-2 of PR #48) at the time the
//   reader named for it, else the read's time (card RV5: the read's ts is
//   the server's own clock, and a requested time moves the window only);
// - an allowed event that changed what an item's grants admit
//   (`grantsChanged`) in a way the oracle refuses (`grantChangeProblem`: who
//   widened them, and what was added; ADR 0021, D4 and ADR 0034).
//
// Card E2.6's events (ADR 0007's amendment): the offboarding's begin mark,
// the conflict, erasing and not-handed-over denies, and adoption's deletions
// change no item, so the replay passes over them and counts them by rule
// (each a fixed id naming nothing). A withdrawal (`engram/adopt/withdrawn`)
// puts an item back as it stood before an adoption the withdrawal names: the
// replay takes it as it takes any allowed change, the oracle accepts it only
// when the named event is an adoption of that item and the item put back is
// that item as it stood just before it (`withdrawalProblem`, verification
// finding V-4 of PR #50), and it is never counted as a narrowing by someone
// other than the owner. A narrowing (`engram/adopt/narrowed`) may only remove
// grants (`narrowingProblem`); the plane's recovery makes it, so it is not
// counted under `watch.narrowed` either.
//
// Who read is known by id only: the log does not record an actor's level or
// memberships. The member declares the actor they ran as (the flags they
// gave `engram serve`, `engram mcp` and the CLI), and the report prints that
// actor's shape (`declared`) so a reader of the report can see whether it
// was the member's own scope alone (review finding E95-5); any other
// principal is judged as the CLI builds an actor from `--as` alone (its own
// scope, its level; `buildActor` in packages/cli/src/setup.ts).
import { createHash } from "node:crypto";
import type { Actor } from "./actor.ts";
import {
  addedGrants,
  type Earlier,
  grantChangeProblem,
  grantsChanged,
  grantsWiden,
  NARROWED_RULE,
  narrowingProblem,
  priorVersion,
  readable,
  replayEvent,
  UNTRUSTED_KINDS,
  WITHDRAWN_RULE,
  withdrawalProblem,
  withinValidity,
} from "./oracle.ts";
import { isExportEvent } from "./plane/export.ts";
import { readValidAt } from "./plane/read-reason.ts";
import { SCOPE_LIST_PREFIX } from "./plane/scopes.ts";
import {
  type MemoryEvent,
  MemoryEvent as MemoryEventSchema,
  type MemoryItem,
  type Policy,
  Scope,
  ScopeLevel,
} from "./schema.ts";

export const REPORT_FORMAT = "engram-dogfood-report/3";

export interface DogfoodReport {
  report: typeof REPORT_FORMAT;
  /** sha256 of the policy the log was judged under, so members can check they ran the same one. */
  policy_sha256: string;
  /**
   * The shape of the actor the member declared, without names: its level,
   * how many memberships it has at each level, and whether it is exactly its
   * own scope (`--member person:<you>` alone, or none).
   */
  declared: {
    level: string;
    memberships_by_level: Record<string, number>;
    own_scope_only: boolean;
  };
  events: number;
  /** Distinct UTC days with an event, and the days from the first event's day to the last's. */
  days_with_events: number;
  span_days: number;
  /** Events by operation and decision. */
  by_op: Record<string, Record<string, number>>;
  reads: {
    events: number;
    items_returned: number;
    /** Items the oracle admits for the reader only through a grant. */
    items_via_grant: number;
    as_declared: number;
    as_others: number;
    /** Scope listings (Plane.listScopes, card E8.14): read events that return no item, counted apart. */
    scope_lists: number;
  };
  writes: { allowed: number; denied: number };
  /** Allowed events that changed what an item's grants admit, and the grants they added and removed. */
  grants: { changes: number; added: number; removed: number };
  /** Denied events by rule id; a rule id outside the fixed list is counted under `other`. */
  denials: Record<string, number>;
  asks: number;
  bypass_blocked: number;
  violations: { read: number; grant_change: number; total: number };
  /**
   * Not violations, counted for the lead: allowed events that raised an
   * item's provenance from an untrusted kind (model, compaction, external)
   * to a trusted one (a grant on such an item is a violation), which
   * adoption no longer does since card RV4, so any count here is a finding
   * for the lead; and grant changes that only narrowed what
   * the grants admit, made by someone other than the owner's grant change or
   * write (a promotion carrying a grant its new class switches off, review
   * finding E95-4).
   */
  watch: { provenance_raised: number; narrowed: number };
}

/**
 * The actor a principal is judged as when the member did not declare it: the
 * CLI's default for `--as` alone (packages/cli/src/setup.ts, buildActor).
 */
export function defaultActor(id: string): Actor {
  if (!Scope.safeParse(id).success) return { id, level: "person", memberships: [] };
  const level = (id === "org" ? "org" : id.split(":")[0]) as Actor["level"];
  return { id, level, memberships: [id] };
}

/** Every rule id core names under `engram/` (a test checks the list against the source). */
export const ENGRAM_RULES: readonly string[] = [
  "engram/adopt/erased",
  "engram/adopt/narrowed",
  "engram/adopt/rekeyed",
  "engram/adopt/retract",
  "engram/adopt/withdrawn",
  "engram/bypass/foreign-result",
  "engram/bypass/store-command",
  "engram/bypass/store-path",
  "engram/drift/membership",
  "engram/drift/not-due",
  "engram/drift/off",
  "engram/drift/status",
  "engram/drift/thresholds",
  "engram/drift/validation-source",
  "engram/grant/change",
  "engram/grant/conflict",
  "engram/grant/expired",
  "engram/grant/owner",
  "engram/grant/source",
  "engram/grant/status",
  "engram/grant/unchanged",
  "engram/lint/membership",
  "engram/offboard/begin",
  "engram/offboard/conflict",
  "engram/offboard/erase",
  "engram/offboard/erasing",
  "engram/offboard/handover",
  "engram/offboard/membership",
  "engram/offboard/not-handed-over",
  "engram/offboard/report",
  "engram/offboard/swept",
  "engram/promote/conflict",
  "engram/promote/duplicate",
  "engram/promote/expired",
  "engram/promote/hidden-text",
  "engram/promote/membership",
  "engram/promote/no-evidence",
  "engram/promote/not-candidate",
  "engram/promote/owner-person",
  "engram/promote/replay-item",
  "engram/promote/replay-split",
  "engram/promote/reviewer",
  "engram/promote/safety-scan",
  "engram/promote/validation-source",
  "engram/promote/widening-source",
  "engram/read/default-deny",
  "engram/read/status",
  "engram/read/ttl",
  "engram/read/validity",
  "engram/retention/item-ttl",
  "engram/retention/membership",
  "engram/retention/protected",
  "engram/retention/sweep",
  "engram/write/conflict",
  "engram/write/content-size",
  "engram/write/default-deny",
  "engram/write/downgrade",
  "engram/write/erased",
  "engram/write/grant",
  "engram/write/guard-failure",
  "engram/write/injection-screen",
  "engram/write/membership",
  "engram/write/move",
  "engram/write/pii",
  "engram/write/retired-content",
  "engram/write/schema",
  "engram/write/secret",
  "engram/write/source-isolation",
  "engram/write/store-failure",
  "engram/write/version",
];

const PROMOTION_RULES = ["episodic-to-semantic", "review", "procedural", "superseded"];
const CLASSES = ["episodic", "semantic", "procedural"];

/**
 * The rule ids the report may print (review finding E95-12): core's
 * `engram/...` ids, and the ids a bundled policy (`profile.<name>` or
 * `preset.<name>`) builds from its own fields: write and read per level, read
 * through grants, retention per level and class, promotion, and each enabled
 * lint. Any other id is counted as `other`, since a policy of another name
 * could carry anything in its id.
 */
export function printableRules(policy: Policy): Set<string> {
  const out = new Set(ENGRAM_RULES);
  if (!/^(?:profile|preset)\.[a-z]+$/.test(policy.id)) return out;
  const p = policy.id;
  for (const level of ScopeLevel.options) {
    out.add(`${p}/write/${level}`);
    out.add(`${p}/read/${level}`);
    for (const c of CLASSES) out.add(`${p}/retention/${level}/${c}`);
  }
  out.add(`${p}/read/grants`);
  for (const rule of PROMOTION_RULES) out.add(`${p}/promotion/${rule}`);
  for (const lint of policy.lints.enabled)
    if (/^[a-z0-9-]+$/.test(lint)) out.add(`${p}/lint/${lint}`);
  return out;
}

/** JSON with object keys sorted at every depth. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v !== null && typeof v === "object")
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

/**
 * Each stored row parsed and checked against the `MemoryEvent` schema
 * (review finding E95-8): the events that parse, and the seq of each row
 * that does not. Never the parser's message, which can quote the row.
 */
export function parseEventRows(rows: readonly { seq: unknown; body: unknown }[]): {
  events: MemoryEvent[];
  bad: number[];
} {
  const events: MemoryEvent[] = [];
  const bad: number[] = [];
  for (const row of rows) {
    let parsed: ReturnType<typeof MemoryEventSchema.safeParse>;
    try {
      parsed = MemoryEventSchema.safeParse(JSON.parse(String(row.body)));
    } catch {
      bad.push(Number(row.seq));
      continue;
    }
    if (parsed.success && parsed.data.seq === Number(row.seq)) events.push(parsed.data);
    else bad.push(Number(row.seq));
  }
  return { events, bad };
}

const bump = (m: Record<string, number>, k: string) => {
  m[k] = (m[k] ?? 0) + 1;
};
const dayNumber = (ts: string) =>
  Math.floor(Date.parse(`${ts.slice(0, 10)}T00:00:00Z`) / 86_400_000);

/** The declared actor's shape, without names. */
function shapeOf(actor: Actor | undefined): DogfoodReport["declared"] {
  const byLevel: Record<string, number> = { org: 0, person: 0, role: 0, team: 0 };
  for (const m of actor?.memberships ?? [])
    bump(byLevel, m === "org" ? "org" : (m.split(":")[0] ?? "other"));
  const own =
    actor !== undefined &&
    actor.memberships.length === 1 &&
    actor.memberships[0] === actor.id &&
    actor.level === defaultActor(actor.id).level;
  return { level: actor?.level ?? "none", memberships_by_level: byLevel, own_scope_only: own };
}

/**
 * The report of `events` (a whole log, parsed, in seq order) under `policy`,
 * with the actors the member declares (the first is the member's);
 * `details` names each violation, for the member alone.
 */
export function dogfoodReport(
  events: readonly MemoryEvent[],
  policy: Policy,
  declared: readonly Actor[],
): { report: DogfoodReport; details: string[] } {
  const actors = new Map(declared.map((a) => [a.id, a]));
  const actorFor = (id: string) => actors.get(id) ?? defaultActor(id);
  const rules = printableRules(policy);
  const scopeOnly: Policy = { ...policy, read: { ...policy.read, honour_grants: false } };
  const state = new Map<string, MemoryItem>();
  const details: string[] = [];
  const days = new Set<number>();
  const r: DogfoodReport = {
    report: REPORT_FORMAT,
    policy_sha256: createHash("sha256").update(canonical(policy)).digest("hex"),
    declared: shapeOf(declared[0]),
    events: 0,
    days_with_events: 0,
    span_days: 0,
    by_op: {},
    reads: {
      events: 0,
      items_returned: 0,
      items_via_grant: 0,
      as_declared: 0,
      as_others: 0,
      scope_lists: 0,
    },
    writes: { allowed: 0, denied: 0 },
    grants: { changes: 0, added: 0, removed: 0 },
    denials: {},
    asks: 0,
    bypass_blocked: 0,
    violations: { read: 0, grant_change: 0, total: 0 },
    watch: { provenance_raised: 0, narrowed: 0 },
  };
  /** Items some allowed version of which held untrusted content. */
  const held = new Set<string>();
  /** Every event of the log so far, with its item's state just before it, for judging a withdrawal (card E2.6). */
  const seen = new Map<string, Earlier>();

  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    r.events++;
    days.add(dayNumber(e.ts));
    r.by_op[e.op] ??= {};
    bump(r.by_op[e.op] as Record<string, number>, e.decision);
    if (e.decision === "deny") bump(r.denials, rules.has(e.policy_id) ? e.policy_id : "other");
    if (e.decision === "ask") r.asks++;
    if (e.op === "bypass_blocked") r.bypass_blocked++;
    if (e.op === "write" && e.decision !== "ask")
      r.writes[e.decision === "allow" ? "allowed" : "denied"]++;

    // A scope listing is a read event that names no item (card E8.14, review
    // finding E8.14-8): counted apart, so `reads` counts reads only. One that
    // names an item is judged as a read, whatever its reason says.
    if (
      e.op === "read" &&
      e.reason.startsWith(SCOPE_LIST_PREFIX) &&
      (e.item_ids ?? []).length === 0
    )
      r.reads.scope_lists++;
    // An export (card E9.8) is recorded as a read event but returns no read:
    // it is counted in events and by_op only (finding E9.8-9).
    else if (e.op === "read" && e.decision === "allow" && !isExportEvent(e)) {
      r.reads.events++;
      r.reads[actors.has(e.actor) ? "as_declared" : "as_others"]++;
      const actor = actorFor(e.actor);
      // Validity windows at the time the reader named, if it named one (card
      // RV5, finding RV-SRF-2); scope, grants and ttl at the read's ts, the
      // server's own clock, whatever the reader named.
      const validAt = readValidAt(e) ?? e.ts;
      for (const id of e.item_ids ?? []) {
        r.reads.items_returned++;
        const was = state.get(id);
        const why =
          was === undefined
            ? "no allowed event left it"
            : was.status !== "active"
              ? `it was ${was.status}`
              : !readable(policy, actor, was, e.ts)
                ? "the reader's scope and live grants exclude it"
                : !withinValidity(was, validAt)
                  ? "it was outside its validity window"
                  : undefined;
        if (why !== undefined) {
          r.violations.read++;
          details.push(`read event ${e.seq} at ${e.ts} by ${e.actor} returned ${id}: ${why}`);
        } else if (!readable(scopeOnly, actor, was as MemoryItem, e.ts)) r.reads.items_via_grant++;
      }
    }

    // The plane's own recovery events are judged whatever they do to the
    // grants: a withdrawal or a narrowing that changes content, removes
    // nothing or names no adoption is a violation (verification pass 3, V3-4).
    const recovery =
      e.decision === "allow" &&
      e.item !== undefined &&
      (e.policy_id === WITHDRAWN_RULE || e.policy_id === NARROWED_RULE);
    if (recovery && e.item) {
      const before = priorVersion(state, e);
      const problem =
        e.policy_id === WITHDRAWN_RULE
          ? withdrawalProblem(e, (id) => seen.get(id))
          : narrowingProblem(before, e);
      if (problem !== undefined) {
        r.violations.grant_change++;
        details.push(
          `${e.op} event ${e.seq} at ${e.ts} by ${e.actor} (${e.policy_id}) on ${e.item.id}: ${problem}`,
        );
      }
    }
    if (e.decision === "allow" && e.item) {
      const item = e.item;
      const before = priorVersion(state, e);
      const untrusted = UNTRUSTED_KINDS.includes(item.provenance.kind);
      const heldBefore =
        before !== undefined &&
        (held.has(before.id) || UNTRUSTED_KINDS.includes(before.provenance.kind));
      if (before && UNTRUSTED_KINDS.includes(before.provenance.kind) && !untrusted)
        r.watch.provenance_raised++;
      if (untrusted || heldBefore) held.add(item.id);
      if (grantsChanged(before, item)) {
        r.grants.changes++;
        r.grants.added += addedGrants(before?.grants ?? [], item.grants).length;
        r.grants.removed += addedGrants(item.grants, before?.grants ?? []).length;
        const problem = recovery
          ? undefined
          : grantChangeProblem(policy, actorFor(e.actor), before, e, heldBefore, (id) =>
              seen.get(id),
            );
        if (problem !== undefined) {
          r.violations.grant_change++;
          details.push(
            `${e.op} event ${e.seq} at ${e.ts} by ${e.actor} (${e.policy_id}) on ${item.id}: ${problem}`,
          );
        } else if (!grantsWiden(before, item)) {
          const owner = before?.owner ?? item.owner;
          const ownChange =
            e.actor === owner &&
            (e.op === "write" || (e.op === "update" && e.policy_id === "engram/grant/change"));
          // A withdrawal puts back an earlier version: not a narrowing by another.
          if (!ownChange && e.policy_id !== WITHDRAWN_RULE && e.policy_id !== NARROWED_RULE)
            r.watch.narrowed++;
        }
      }
    }
    seen.set(e.id, { event: e, before: e.item_id === null ? undefined : state.get(e.item_id) });
    replayEvent(state, e);
  }

  r.violations.total = r.violations.read + r.violations.grant_change;
  r.days_with_events = days.size;
  r.span_days = days.size === 0 ? 0 : Math.max(...days) - Math.min(...days);
  return { report: r, details };
}

/** The report as printed: JSON, keys sorted at every depth, two-space indent; byte-stable. */
export function formatReport(report: DogfoodReport): string {
  return JSON.stringify(JSON.parse(canonical(report)), null, 2);
}
