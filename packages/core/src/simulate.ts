// The Simulator interface (docs/architecture.md "Interfaces", ADR 0001) and
// its shapes (card E8.9). A recorded workload is the sequence of plane calls
// a run or a session made: who called, when, and with what (the item
// written, the query read, the scope swept, the item promoted). The
// simulator replays it through a fresh plane under each of two policies, on a
// scratch log and a scratch in-memory store, and reports where the decisions,
// the recall and the evictions differ, with zero model calls. Events alone
// are not a workload: a denied write's event carries no item, a read's event
// no query and an event's actor no memberships, so none of them could be
// decided again under another policy (docs/log/2026-11-06-e8-9-workload-is-calls.md).
//
// A pi session reaches the simulator already converted into a workload by
// packages/pi-extension (card PX2), so core needs no pi type. The
// implementation is plane/simulate.ts.
import { z } from "zod";
import { ActorShape } from "./actor.ts";
import { JsonValue, type Policy, Timestamp } from "./schema.ts";

export type Decision = "allow" | "deny" | "ask";

const name = z.string().min(1).meta({ description: "A key of the workload's actors." });

/** One recorded plane call, made as the actor `as` names at `at`. */
export const WorkloadStep = z.discriminatedUnion("op", [
  z.strictObject({
    op: z.literal("write"),
    as: name,
    at: Timestamp,
    item: z.record(z.string(), JsonValue).meta({
      description:
        "The MemoryItem (#/components/schemas/MemoryItem) as the caller sent it; one that fails the schema replays as the plane's engram/write/schema denial.",
    }),
  }),
  z.strictObject({ op: z.literal("read"), as: name, at: Timestamp, text: z.string().optional() }),
  z.strictObject({ op: z.literal("retain"), as: name, at: Timestamp, scope: z.string() }),
  z.strictObject({
    op: z.literal("promote"),
    as: name,
    at: Timestamp,
    item_id: z.string(),
    to_scope: z.string(),
    review: z.boolean().optional(),
  }),
]);

/** A recorded workload: its actors by name and its calls in the order they were made. */
export const Workload = z
  .strictObject({
    id: z.string().min(1),
    /** What the workload records, for the reader of a fixture. */
    description: z.string().optional(),
    actors: z.record(z.string(), ActorShape),
    steps: z.array(WorkloadStep),
    /**
     * How the recorded run read (PlaneDeps.retrieval); unset, the plane's own
     * setting. The scratch store has no search, so without the core pipeline
     * the plane matches query terms itself, as it does on a store without
     * search.
     */
    retrieval: z
      .strictObject({ pipeline: z.literal("core"), limit: z.int().positive().optional() })
      .optional(),
  })
  .meta({
    description:
      "A recorded workload (card E8.9): its actors by name and the plane calls it made, in order. Each write carries its whole item.",
  });

/** What one step decided under one policy. */
export const StepOutcome = z.strictObject({
  step: z.int().nonnegative(),
  op: z.enum(["write", "read", "retain", "promote"]),
  actor: z.string(),
  item_id: z.string().nullable(),
  decision: z.enum(["allow", "deny", "ask"]),
  reason: z.string(),
  /** The deciding rule, in the format of MemoryEvent.policy_id. */
  policy_id: z.string(),
  /** A read's returned item ids, in rank order; empty for other ops. */
  returned: z.array(z.string()),
  /** Items this step retired over a budget (op evict, decision allow). */
  evicted: z.array(z.string()),
  /** Items this step retired past their ttl (op retire, decision allow). */
  expired: z.array(z.string()),
  /** Manual-eviction asks this step appended (op evict, decision ask). */
  asked: z.int().nonnegative(),
});

/**
 * The utility proxy (ADR 0025's deterministic proxy, after MERIT's marginal
 * utility framing): how much the reads got back. It counts recall, not
 * whether the recall was right.
 */
export const UtilityProxy = z.strictObject({
  reads: z.int().nonnegative(),
  /** Items returned over all reads. */
  returned: z.int().nonnegative(),
  /** Reads that returned at least one item. */
  reads_with_recall: z.int().nonnegative(),
  /** returned / reads; 0 with no read. */
  mean_returned: z.number().nonnegative(),
});

/** One policy's replay of the workload. */
export const PolicyRun = z.strictObject({
  policy_id: z.string(),
  policy_version: z.int().positive(),
  outcomes: z.array(StepOutcome),
  /** Decisions of the steps, by kind. */
  totals: z.strictObject({
    allow: z.int().nonnegative(),
    deny: z.int().nonnegative(),
    ask: z.int().nonnegative(),
  }),
  utility: UtilityProxy,
  evictions: z.strictObject({
    evicted: z.int().nonnegative(),
    expired: z.int().nonnegative(),
    asked: z.int().nonnegative(),
  }),
  /** Active items at the end of the replay, by scope. */
  active: z.record(z.string(), z.int().nonnegative()),
});

/** A step whose decision, recall or retirements differ between the two runs. */
export const StepChange = z.strictObject({
  step: z.int().nonnegative(),
  op: z.enum(["write", "read", "retain", "promote"]),
  actor: z.string(),
  item_id: z.string().nullable(),
  baseline: StepOutcome,
  candidate: StepOutcome,
});

export const SimReport = z
  .strictObject({
    workload_id: z.string(),
    /** The plane's own policy. */
    baseline: PolicyRun,
    /** The policy the workload was replayed under. */
    candidate: PolicyRun,
    changed: z.array(StepChange),
    /** The simulator never calls a model. */
    model_calls: z.literal(0),
  })
  .meta({
    description:
      "A workload replayed under the plane's policy (baseline) and a candidate policy, each on a scratch log and store: decisions, the utility proxy (items reads returned) and evictions per policy, and the steps that differ (card E8.9).",
  });

export type WorkloadStep = z.infer<typeof WorkloadStep>;
export type Workload = z.infer<typeof Workload>;
export type StepOutcome = z.infer<typeof StepOutcome>;
export type UtilityProxy = z.infer<typeof UtilityProxy>;
export type PolicyRun = z.infer<typeof PolicyRun>;
export type StepChange = z.infer<typeof StepChange>;
export type SimReport = z.infer<typeof SimReport>;

export interface Simulator {
  /** Replays `workload` under the simulator's baseline policy and `policy`. */
  simulate(workload: Workload, policy: Policy): Promise<SimReport>;
}
