// A Simulator fake: it walks the workload and, by default, keeps every
// recorded decision, so a report differs from the recording only where a test
// scripts it with `decide`. It holds no policy logic and calls no model.
// A decision's policy_id is the id of the deciding rule (see SimDecision):
// the recorded rule when the decision is kept, the rule `decide` names, or
// `<policy id>/scripted` when `decide` returns a bare decision.
import type { MemoryEvent, Policy } from "../../src/schema.ts";
import type { Decision, Simulator } from "../../src/simulate.ts";

/** A scripted decision with the rule that made it. */
export interface ScriptedDecision {
  decision: Decision;
  policy_id: string;
  reason: string;
}

export interface FakeSimulatorOptions {
  /** The decision the candidate policy makes for an event; defaults to the recorded one. */
  decide?: (event: MemoryEvent, policy: Policy) => Decision | ScriptedDecision;
}

export function createFakeSimulator({ decide }: FakeSimulatorOptions = {}): Simulator {
  return {
    async simulate(workload, policy) {
      const decisions = workload.events.map((e) => {
        const scripted = decide?.(e, policy);
        const outcome: ScriptedDecision =
          scripted === undefined
            ? { decision: e.decision, policy_id: e.policy_id, reason: e.reason }
            : typeof scripted === "string"
              ? {
                  decision: scripted,
                  policy_id: `${policy.id}/scripted`,
                  reason: "scripted by the fake simulator",
                }
              : scripted;
        return {
          seq: e.seq,
          op: e.op,
          item_id: e.item_id,
          recorded: e.decision,
          simulated: outcome.decision,
          reason: outcome.reason,
          policy_id: outcome.policy_id,
        };
      });
      const totals: Record<Decision, number> = { allow: 0, deny: 0, ask: 0 };
      for (const d of decisions) totals[d.simulated]++;
      return {
        workload_id: workload.id,
        policy_id: policy.id,
        policy_version: policy.version,
        decisions,
        totals,
        changed: decisions.filter((d) => d.simulated !== d.recorded).length,
        model_calls: 0,
      };
    },
  };
}
