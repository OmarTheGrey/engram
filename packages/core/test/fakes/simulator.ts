// A Simulator fake: it walks the workload's steps and decides each one as a
// test scripts it with `decide`, under the baseline policy and under the
// candidate, so a report differs between them only where the script says.
// Unscripted, every step is allowed. It holds no policy logic, opens no log
// and calls no model. A decision's policy_id is the rule `decide` names, or
// `<policy id>/scripted` when it returns a bare decision.
import type { Policy } from "../../src/schema.ts";
import type {
  Decision,
  PolicyRun,
  Simulator,
  StepOutcome,
  WorkloadStep,
} from "../../src/simulate.ts";

/** A scripted decision with the rule that made it. */
export interface ScriptedDecision {
  decision: Decision;
  policy_id: string;
  reason: string;
}

export interface FakeSimulatorOptions {
  /** The plane's own policy, the report's baseline. */
  baseline: Policy;
  /** The decision `policy` makes for a step; defaults to allow. */
  decide?: (step: WorkloadStep, index: number, policy: Policy) => Decision | ScriptedDecision;
}

export function createFakeSimulator({ baseline, decide }: FakeSimulatorOptions): Simulator {
  const run = (steps: WorkloadStep[], actors: Record<string, { id: string }>, policy: Policy) => {
    const outcomes: StepOutcome[] = steps.map((step, i) => {
      const scripted = decide?.(step, i, policy) ?? "allow";
      const outcome: ScriptedDecision =
        typeof scripted === "string"
          ? {
              decision: scripted,
              policy_id: `${policy.id}/scripted`,
              reason: "scripted by the fake simulator",
            }
          : scripted;
      return {
        step: i,
        op: step.op,
        actor: actors[step.as]?.id ?? step.as,
        item_id: step.op === "promote" ? step.item_id : null,
        ...outcome,
        returned: [],
        evicted: [],
        expired: [],
        asked: 0,
      };
    });
    const totals: Record<Decision, number> = { allow: 0, deny: 0, ask: 0 };
    for (const o of outcomes) totals[o.decision]++;
    const reads = outcomes.filter((o) => o.op === "read").length;
    const result: PolicyRun = {
      policy_id: policy.id,
      policy_version: policy.version,
      outcomes,
      totals,
      utility: { reads, returned: 0, reads_with_recall: 0, mean_returned: 0 },
      evictions: { evicted: 0, expired: 0, asked: 0 },
      active: {},
    };
    return result;
  };
  return {
    async simulate(workload, policy) {
      const b = run(workload.steps, workload.actors, baseline);
      const c = run(workload.steps, workload.actors, policy);
      const changed = b.outcomes.flatMap((x, i) => {
        const y = c.outcomes[i] as StepOutcome;
        return x.decision === y.decision
          ? []
          : [{ step: i, op: x.op, actor: x.actor, item_id: x.item_id, baseline: x, candidate: y }];
      });
      return { workload_id: workload.id, baseline: b, candidate: c, changed, model_calls: 0 };
    },
  };
}
