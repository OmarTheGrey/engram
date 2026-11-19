// The twin dogfood's violation report (card E9.5, docs/dogfood.md): a
// member's own event log, replayed on the member's own machine, judged by the
// invariants' oracle (./oracle.ts), never by the evaluator, and reduced to
// aggregate counts. Rule 12 of AGENTS.md: dogfood content never leaves the
// member's machine, so the report holds counts, fixed keys, rule ids of the
// bundled shape and the policy's hash; never content, an item id, a
// principal or a scope. `details` names the violations for the member alone
// (printed to stderr by scripts/dogfood-report.ts with --detail, never sent).
//
// A violation is either:
//
// - a read that returned an item the reader could not read at that time: the
//   item, as the allowed events before the read leave it in the oracle's own
//   replay, is missing, not active, or not `readable` by the reader at the
//   read's time (invariant 1, as invariant 5's grant walk judges a read);
// - an allowed event that changed what an item's grants admit
//   (`grantsChanged`) and was not the owner's grant change or the owner's own
//   user- or import-sourced write (`grantChangePermitted`, ADR 0034).
//
// Who read is known by id only: the log does not record an actor's level or
// memberships. The member declares the actors they ran as (the flags they
// gave `engram serve`, `engram mcp` and the CLI); any other principal is
// judged as the CLI builds an actor from `--as` alone (its own scope, its
// level; `buildActor` in packages/cli/src/setup.ts).
import { createHash } from "node:crypto";
import type { Actor } from "./actor.ts";
import {
  grantChangePermitted,
  grantsAlike,
  grantsChanged,
  priorVersion,
  readable,
  replayEvent,
  UNTRUSTED_KINDS,
} from "./oracle.ts";
import type { Grant, MemoryEvent, MemoryItem, Policy } from "./schema.ts";
import { Scope } from "./schema.ts";

export const REPORT_FORMAT = "engram-dogfood-report/1";

export interface DogfoodReport {
  report: typeof REPORT_FORMAT;
  /** sha256 of the policy the log was judged under, so members can check they ran the same one. */
  policy_sha256: string;
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
  };
  writes: { allowed: number; denied: number };
  /** Allowed events that changed what an item's grants admit, and the grants they added and removed. */
  grants: { changes: number; added: number; removed: number };
  /** Denied events by rule id; a rule id of another shape is counted under `other`. */
  denials: Record<string, number>;
  asks: number;
  bypass_blocked: number;
  violations: { read: number; grant_change: number; total: number };
  /**
   * Not violations by the two kinds above, counted for the lead (finding of
   * card E9.5): allowed events that raised an item's provenance from an
   * untrusted kind (model, compaction, external) to a trusted one, as the
   * files adapter's re-adoption does, and grants added to an item that once
   * held untrusted content, which the gate refuses only by the current kind.
   */
  watch: { provenance_raised: number; granted_after_raise: number };
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

/** A rule id of the bundled shape (`engram/...`, `preset.<name>/...`, `profile.<name>/...`), else `other`. */
const RULE = /^(?:engram|preset\.[a-z]+|profile\.[a-z]+)(?:\/[a-z0-9-]+){1,4}$/;
const ruleName = (policyId: string) => (RULE.test(policyId) ? policyId : "other");

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

/** The grants of `b` that `a` lacks, counted as multisets. */
function missingFrom(a: readonly Grant[], b: readonly Grant[]): number {
  const left = [...a];
  let n = 0;
  for (const g of b) {
    const k = left.findIndex((h) => grantsAlike(g, h));
    if (k === -1) n++;
    else left.splice(k, 1);
  }
  return n;
}

const bump = (m: Record<string, number>, k: string) => {
  m[k] = (m[k] ?? 0) + 1;
};
const dayNumber = (ts: string) =>
  Math.floor(Date.parse(`${ts.slice(0, 10)}T00:00:00Z`) / 86_400_000);

/**
 * The report of `events` (a whole log, in seq order) under `policy`, with the
 * actors the member declares; `details` names each violation, for the member
 * alone.
 */
export function dogfoodReport(
  events: readonly MemoryEvent[],
  policy: Policy,
  declared: readonly Actor[],
): { report: DogfoodReport; details: string[] } {
  const actors = new Map(declared.map((a) => [a.id, a]));
  const scopeOnly: Policy = { ...policy, read: { ...policy.read, honour_grants: false } };
  const state = new Map<string, MemoryItem>();
  const details: string[] = [];
  const days = new Set<number>();
  const r: DogfoodReport = {
    report: REPORT_FORMAT,
    policy_sha256: createHash("sha256").update(canonical(policy)).digest("hex"),
    events: 0,
    days_with_events: 0,
    span_days: 0,
    by_op: {},
    reads: { events: 0, items_returned: 0, items_via_grant: 0, as_declared: 0, as_others: 0 },
    writes: { allowed: 0, denied: 0 },
    grants: { changes: 0, added: 0, removed: 0 },
    denials: {},
    asks: 0,
    bypass_blocked: 0,
    violations: { read: 0, grant_change: 0, total: 0 },
    watch: { provenance_raised: 0, granted_after_raise: 0 },
  };
  /** Items some allowed version of which held untrusted content. */
  const once = new Set<string>();

  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    r.events++;
    days.add(dayNumber(e.ts));
    r.by_op[e.op] ??= {};
    bump(r.by_op[e.op] as Record<string, number>, e.decision);
    if (e.decision === "deny") bump(r.denials, ruleName(e.policy_id));
    if (e.decision === "ask") r.asks++;
    if (e.op === "bypass_blocked") r.bypass_blocked++;
    if (e.op === "write" && e.decision !== "ask")
      r.writes[e.decision === "allow" ? "allowed" : "denied"]++;

    if (e.op === "read" && e.decision === "allow") {
      r.reads.events++;
      const reader = actors.get(e.actor);
      r.reads[reader ? "as_declared" : "as_others"]++;
      const actor = reader ?? defaultActor(e.actor);
      for (const id of e.item_ids ?? []) {
        r.reads.items_returned++;
        const was = state.get(id);
        const why =
          was === undefined
            ? "no allowed event left it"
            : was.status !== "active"
              ? `it was ${was.status}`
              : !readable(policy, actor, was, e.ts)
                ? "the reader's scope and grants exclude it"
                : undefined;
        if (why !== undefined) {
          r.violations.read++;
          details.push(`read event ${e.seq} at ${e.ts} by ${e.actor} returned ${id}: ${why}`);
        } else if (!readable(scopeOnly, actor, was as MemoryItem, e.ts)) r.reads.items_via_grant++;
      }
    }

    if (e.decision === "allow" && e.item) {
      const before = priorVersion(state, e);
      const untrusted = UNTRUSTED_KINDS.includes(e.item.provenance.kind);
      if (before && UNTRUSTED_KINDS.includes(before.provenance.kind) && !untrusted)
        r.watch.provenance_raised++;
      if (untrusted || (before && once.has(before.id))) once.add(e.item.id);
      if (grantsChanged(before, e.item)) {
        const added = missingFrom(before?.grants ?? [], e.item.grants);
        if (added > 0 && once.has(e.item.id) && !untrusted) r.watch.granted_after_raise++;
        r.grants.changes++;
        r.grants.added += added;
        r.grants.removed += missingFrom(e.item.grants, before?.grants ?? []);
        if (!grantChangePermitted(before, e)) {
          r.violations.grant_change++;
          details.push(
            `${e.op} event ${e.seq} at ${e.ts} by ${e.actor} (${e.policy_id}) changed what the grants of ${e.item.id} admit; only its owner may, by a grant change or a user- or import-sourced write`,
          );
        }
      }
    }
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
