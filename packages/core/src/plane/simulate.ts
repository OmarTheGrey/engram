// The policy simulator (card E8.9, docs/architecture.md "Interfaces"): a
// recorded workload replayed through the plane under the plane's own policy
// and under a candidate one, each on its own scratch log (an in-memory
// SQLite database) and scratch store (a map, below), so the decisions are the
// plane's own write gate, read filter, retention and promotion, not a copy
// of them. Nothing reads the plane's real log, projection or store: the
// report depends only on the workload and the two policies, so it hands no
// caller an item it could not read (invariant 1) and writes nothing a read
// could later return. No model is called, and ids come from the step's index
// and a counter, so the same workload gives the same report.
//
// Because the reads are replayed, a utility eviction is decided again from
// the replayed reads' explanation rows, which a replay of the event log alone
// cannot do (ADR 0025, finding P4-5).
import type { Actor } from "../actor.ts";
import { InvalidCallError } from "../actor.ts";
import type { Adapter, StoreRef } from "../adapter.ts";
import { migrate } from "../db/migrate.ts";
import { openSqlite } from "../db/sqlite.ts";
import { currentItems } from "../events.ts";
import type { PlaneDeps } from "../plane.ts";
import type { MemoryEvent, MemoryItem, Policy } from "../schema.ts";
import {
  type Decision,
  type PolicyRun,
  type SimReport,
  type StepChange,
  type StepOutcome,
  Workload,
  type WorkloadStep,
} from "../simulate.ts";
import { promote } from "./promote.ts";
import { filteredRead } from "./read.ts";
import { retain } from "./retention.ts";
import { gatedWrite } from "./write.ts";

/** The name of the scratch store on every ref a simulation records. */
export const SIMULATION_STORE = "simulation";

/**
 * An in-memory store that holds the replayed items for one simulation and is
 * dropped with it. It has no search, so reads match query terms in the plane,
 * as on any store without search.
 */
function scratchStore(): Adapter {
  const items = new Map<string, MemoryItem>();
  return {
    name: SIMULATION_STORE,
    capabilities: {
      native_validity: false,
      native_history: false,
      native_search: false,
      native_graph: false,
    },
    async write(item) {
      const ref: StoreRef = { adapter: SIMULATION_STORE, key: item.id };
      items.set(item.id, { ...item, store_ref: ref });
      return ref;
    },
    async read(ref) {
      return items.get(ref.key);
    },
    async delete(ref) {
      items.delete(ref.key);
    },
    async list(scope) {
      return [...items.values()].filter((i) => i.scope === scope);
    },
  };
}

/**
 * Deterministic UUIDv7s for one simulation's events and promoted items: a
 * fixed time prefix, the step's index and a counter that restarts at each
 * step. An id depends only on the step and its place in it, not on how many
 * events earlier steps appended, so a promotion's new item has the same id
 * under both policies even when one of them evicted or denied more before
 * it, and a later read returning it is not reported as changed.
 */
function stepIds(): { newId: () => string; startStep: (index: number) => void } {
  let step = "0000000";
  let n = 0;
  return {
    newId: () =>
      `01900000-${step.slice(0, 4)}-7${step.slice(4)}-8000-${(n++).toString(16).padStart(12, "0")}`,
    startStep: (index) => {
      step = index.toString(16).padStart(7, "0");
      n = 0;
    },
  };
}

/** The outcome fields a step's events fill in. */
function retirements(events: MemoryEvent[]) {
  const ids = (op: MemoryEvent["op"]) =>
    events.flatMap((e) =>
      e.op === op && e.decision === "allow" && e.item_id !== null ? [e.item_id] : [],
    );
  return {
    evicted: ids("evict"),
    expired: ids("retire").filter(
      (id) =>
        // A promotion's superseded source is retired by the promotion, not by ttl.
        !events.some(
          (e) => e.item_id === id && e.op === "retire" && e.policy_id.endsWith("/superseded"),
        ),
    ),
    asked: events.filter((e) => e.op === "evict" && e.decision === "ask").length,
  };
}

async function runStep(
  deps: PlaneDeps,
  actor: Actor,
  step: WorkloadStep,
  index: number,
): Promise<StepOutcome> {
  const base = { step: index, op: step.op, actor: actor.id };
  switch (step.op) {
    case "write": {
      // The plane validates the item: one that fails the schema is denied as on a real write.
      const r = await gatedWrite(deps, actor, step.item as unknown as MemoryItem, step.at);
      return {
        ...base,
        item_id: r.event.item_id,
        decision: r.event.decision,
        reason: r.event.reason,
        policy_id: r.event.policy_id,
        returned: [],
        ...retirements(r.retention),
      };
    }
    case "read": {
      const r = await filteredRead(deps, actor, {
        at: step.at,
        ...(step.text === undefined ? {} : { text: step.text }),
      });
      return {
        ...base,
        item_id: null,
        decision: r.event.decision,
        reason: r.event.reason,
        policy_id: r.event.policy_id,
        returned: r.items.map((i) => i.id),
        evicted: [],
        expired: [],
        asked: 0,
      };
    }
    case "retain": {
      const r = await retain(deps, actor, step.scope, step.at);
      const first = r.events[0];
      return {
        ...base,
        item_id: null,
        decision: r.decision,
        reason:
          r.decision === "deny"
            ? (first?.reason ?? "denied")
            : `swept ${step.scope}: ${r.expired.length} expired, ${r.evicted.length} evicted`,
        policy_id: first?.policy_id ?? "engram/retention/sweep",
        returned: [],
        ...retirements(r.events),
      };
    }
    case "promote": {
      const r = await promote(
        deps,
        actor,
        step.item_id,
        step.to_scope,
        step.at,
        step.review === undefined ? undefined : { review: step.review },
      );
      return {
        ...base,
        item_id: step.item_id,
        decision: r.decision,
        reason: r.event.reason,
        policy_id: r.event.policy_id,
        returned: [],
        ...retirements(r.events),
      };
    }
  }
}

/**
 * Replays `workload` under `policy` on a scratch log and store and reports
 * what each step decided, the utility proxy and the evictions. Pure apart
 * from the scratch database it opens and closes.
 */
export async function runWorkload(
  workload: Workload,
  policy: Policy,
  retrieval?: PlaneDeps["retrieval"],
): Promise<PolicyRun> {
  const db = openSqlite(":memory:");
  try {
    migrate(db);
    const reading = workload.retrieval ?? retrieval;
    const ids = stepIds();
    const deps: PlaneDeps = {
      db,
      adapter: scratchStore(),
      policy,
      newId: ids.newId,
      ...(reading ? { retrieval: reading } : {}),
    };
    const outcomes: StepOutcome[] = [];
    for (const [i, step] of workload.steps.entries()) {
      ids.startStep(i);
      const actor = workload.actors[step.as] as Actor;
      outcomes.push(await runStep(deps, actor, step, i));
    }
    const totals: Record<Decision, number> = { allow: 0, deny: 0, ask: 0 };
    for (const o of outcomes) totals[o.decision]++;
    const reads = outcomes.filter((o) => o.op === "read");
    const returned = reads.reduce((n, o) => n + o.returned.length, 0);
    const active: Record<string, number> = {};
    for (const item of currentItems(db))
      if (item.status === "active") active[item.scope] = (active[item.scope] ?? 0) + 1;
    return {
      policy_id: policy.id,
      policy_version: policy.version,
      outcomes,
      totals,
      utility: {
        reads: reads.length,
        returned,
        reads_with_recall: reads.filter((o) => o.returned.length > 0).length,
        mean_returned: reads.length === 0 ? 0 : returned / reads.length,
      },
      evictions: {
        evicted: outcomes.reduce((n, o) => n + o.evicted.length, 0),
        expired: outcomes.reduce((n, o) => n + o.expired.length, 0),
        asked: outcomes.reduce((n, o) => n + o.asked, 0),
      },
      active,
    };
  } finally {
    db.close();
  }
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * A step differs when its decision, its recall or what it retired differ.
 * The deciding rule is not compared: its id names its policy, so it differs
 * between any two policies.
 */
function differs(a: StepOutcome, b: StepOutcome): boolean {
  return (
    a.decision !== b.decision ||
    !same(a.returned, b.returned) ||
    !same(a.evicted, b.evicted) ||
    !same(a.expired, b.expired) ||
    a.asked !== b.asked
  );
}

/**
 * Validates the workload, refusing it with InvalidCallError before anything
 * runs: it must match the Workload shape, and every step's `as` must name one
 * of its actors.
 */
export function checkWorkload(input: unknown): Workload {
  const parsed = Workload.safeParse(input);
  if (!parsed.success)
    throw new InvalidCallError(
      `Plane.simulate: invalid workload: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "workload"}: ${i.message}`)
        .join("; ")}`,
    );
  for (const [i, step] of parsed.data.steps.entries())
    if (!Object.hasOwn(parsed.data.actors, step.as))
      throw new InvalidCallError(
        `Plane.simulate: steps.${i}.as: ${JSON.stringify(step.as)} names no actor of the workload`,
      );
  return parsed.data;
}

/**
 * Plane.simulate: the workload under the plane's policy (the baseline) and
 * under `candidate`, with the steps whose outcome differs.
 */
export async function simulate(
  deps: Pick<PlaneDeps, "policy" | "retrieval">,
  input: Workload,
  candidate: Policy,
): Promise<SimReport> {
  const workload = checkWorkload(input);
  const baseline = await runWorkload(workload, deps.policy, deps.retrieval);
  const replayed = await runWorkload(workload, candidate, deps.retrieval);
  const changed: StepChange[] = baseline.outcomes.flatMap((b, i) => {
    const c = replayed.outcomes[i] as StepOutcome;
    return differs(b, c)
      ? [{ step: i, op: b.op, actor: b.actor, item_id: b.item_id, baseline: b, candidate: c }]
      : [];
  });
  return {
    workload_id: workload.id,
    baseline,
    candidate: replayed,
    changed,
    model_calls: 0,
  };
}
