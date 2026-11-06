// Retention on the plane (card E2.4, ADR 0025). The pure evaluator
// (policy/retention.ts) decides; this file reads its inputs from the log and
// appends each decision as one event, mirrored into a pi session by the
// extension like every other event. Retired items stay in the store and in
// the log (ADR 0010): an event sets their projected status, nothing deletes.
//
// Two callers: Plane.retain sweeps one scope, expiry and every budget, as a
// member of it, in the write queue; and the write path runs enforceBudget
// for the written scope and class in the landing write's own queue slot, so
// no write sequence leaves a recency or utility budget exceeded by items not
// past their ttl. Nothing runs on a timer: the plane has no clock, the
// surfaces pass `at`. A reason names no item, seq or count to an actor who
// cannot read the scope (review finding P4-4).
//
// Limit (review finding P4-5): utility counts explanation rows, which are not
// in the event log, so replaying the log reproduces a utility eviction as an
// event but cannot re-decide it, nor can a rebuilt database. The simulator
// (plane/simulate.ts, ADR 0032) replays the reads themselves and so decides it
// again. The next schema PR can put the returned item ids on read events.
import { type Actor, checkCall, InvalidCallError } from "../actor.ts";
import type { Db } from "../db/db.ts";
import { appendEvent, currentItems } from "../events.ts";
import type { PlaneDeps, RetentionReport } from "../plane.ts";
import { readableScope } from "../policy/evaluate.ts";
import {
  evaluateRetention,
  mayRetireByTtl,
  RETENTION_MEMBERSHIP_ID,
  type RetentionOptions,
  type RetentionUsage,
  type Retirement,
  retentionRule,
} from "../policy/retention.ts";
import { type MemoryEvent, type MemoryItem, Scope } from "../schema.ts";
import { inWriteQueue } from "./queue.ts";

/**
 * Recency and utility as the log records them: the seq of the event that
 * last changed each projected item (the items table keeps it, migration 2),
 * and how many explanation rows name each item (migration 3: one row per
 * item a read returned).
 */
export function retentionUsage(db: Db): RetentionUsage {
  const lastChanged = new Map<string, number>();
  for (const row of db.prepare("SELECT id, seq FROM items").all())
    if (row.seq !== null && row.seq !== undefined) lastChanged.set(String(row.id), Number(row.seq));
  const reads = new Map<string, number>();
  for (const row of db
    .prepare("SELECT item_id, count(*) AS n FROM explanations GROUP BY item_id")
    .all())
    reads.set(String(row.item_id), Number(row.n));
  return { lastChanged, reads };
}

/** What one retention event records about its decision. */
type Decision = Pick<MemoryEvent, "op" | "decision" | "item_id" | "reason" | "policy_id">;

/** Appends each decision as one event by `actor` in `scope`, in one transaction. */
function commit(
  deps: PlaneDeps,
  actor: Actor,
  scope: string,
  at: string,
  retirements: readonly Decision[],
): MemoryEvent[] {
  const { db, newId } = deps;
  return db.transaction(() =>
    retirements.map((r) =>
      appendEvent(db, {
        id: newId(),
        ts: at,
        op: r.op,
        item_id: r.item_id,
        actor: actor.id,
        scope_from: null,
        scope_to: scope,
        decision: r.decision,
        reason: r.reason,
        policy_id: r.policy_id,
        schema_version: 0,
      }),
    ),
  );
}

/**
 * The retirements to append: the evaluator's, less a manual rule's ask when
 * one was already recorded for that scope and rule since the last change to
 * any item of that class in the scope, so an unchanged overage is asked
 * about once, not on every sweep (review finding P4-12).
 */
function decide(
  deps: PlaneDeps,
  actor: Actor,
  scope: string,
  at: string,
  items: MemoryItem[],
  options: RetentionOptions,
): Retirement[] {
  const usage = retentionUsage(deps.db);
  const redact = !readableScope(deps.policy, actor, scope);
  const out = evaluateRetention(deps.policy, scope, items, at, usage, { ...options, redact });
  if (!out.some((r) => r.decision === "ask")) return out;
  const asks = deps.db
    .prepare(
      "SELECT seq, body FROM events WHERE op = 'evict' AND decision = 'ask' AND scope_to = ? ORDER BY seq DESC",
    )
    .all(scope)
    .map((row) => ({ seq: Number(row.seq), policy_id: JSON.parse(String(row.body)).policy_id }));
  return out.filter((r) => {
    if (r.decision !== "ask") return true;
    const asked = asks.find((a) => a.policy_id === r.policy_id)?.seq;
    if (asked === undefined) return true;
    const latest = Math.max(
      -1,
      ...items.filter((i) => i.class === r.class).map((i) => usage.lastChanged.get(i.id) ?? -1),
    );
    return latest > Number(asked);
  });
}

/**
 * The budget check of one scope and class, run by the write path after a
 * landing write, inside that write's queue slot: an in-slot primitive, to be
 * called only from inside the write queue (plane/queue.ts), never wrapped in
 * it. `protect` is the item the write just landed, never its own victim
 * (P4-1). Expiry is left to Plane.retain: an expired item is already
 * excluded at read, and holds no slot here (P4-2). Returns the events it
 * appended.
 */
export function enforceBudget(
  deps: PlaneDeps,
  actor: Actor,
  scope: string,
  cls: MemoryItem["class"],
  at: string,
  protect?: string,
): MemoryEvent[] {
  // No budget for this scope level and class: nothing to read or decide.
  if ((retentionRule(deps.policy, scope, cls)?.budget ?? null) === null) return [];
  const items = currentItems(deps.db).filter((i) => i.scope === scope && i.class === cls);
  const retirements = decide(deps, actor, scope, at, items, {
    expiry: false,
    ...(protect === undefined ? {} : { protect }),
  });
  return retirements.length === 0 ? [] : commit(deps, actor, scope, at, retirements);
}

/**
 * Plane.retain: sweeps `scope` at `at` as `actor`, in the write queue. A
 * non-member is refused with one deny event (op retire, no item,
 * `engram/retention/membership`) and nothing is evaluated. A member's sweep
 * retires every item past its ttl, then evicts any budget overage, each one
 * event; a sweep with nothing to do appends nothing. Ttl retirement depends
 * on the caller's clock and has no reinstatement surface yet, so outside the
 * actor's own person scope it needs a user-sourced actor (mayRetireByTtl,
 * review finding P4-6); otherwise the sweep runs the budgets only, and reads
 * still exclude expired items. An invalid actor, time or scope is refused
 * with InvalidCallError before the log is touched.
 */
export function retain(
  deps: PlaneDeps,
  actor: Actor,
  scope: string,
  at: string,
): Promise<RetentionReport> {
  checkCall(actor, at, "retain");
  if (!Scope.safeParse(scope).success)
    throw new InvalidCallError(
      `Plane.retain: invalid scope ${JSON.stringify(scope)}; expected person:<id>, role:<id>, team:<id> or org`,
    );
  return inWriteQueue(deps.db, () => sweep(deps, actor, scope, at));
}

function sweep(deps: PlaneDeps, actor: Actor, scope: string, at: string): RetentionReport {
  if (!actor.memberships.includes(scope)) {
    const [denied] = commit(deps, actor, scope, at, [
      {
        op: "retire",
        decision: "deny",
        item_id: null,
        reason: `${actor.id} is not a member of ${scope}; only a member may run its retention`,
        policy_id: RETENTION_MEMBERSHIP_ID,
      },
    ]);
    return { decision: "deny", events: denied ? [denied] : [], expired: [], evicted: [] };
  }
  const items = currentItems(deps.db).filter((i) => i.scope === scope);
  const retirements = decide(deps, actor, scope, at, items, {
    expiry: mayRetireByTtl(actor, scope),
  });
  const events = retirements.length === 0 ? [] : commit(deps, actor, scope, at, retirements);
  const ids = (op: Retirement["op"]) =>
    retirements.flatMap((r) =>
      r.op === op && r.decision === "allow" && r.item_id !== null ? [r.item_id] : [],
    );
  return { decision: "allow", events, expired: ids("retire"), evicted: ids("evict") };
}
