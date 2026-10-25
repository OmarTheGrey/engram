// A Simulator fake: it walks the workload and, by default, keeps every
// recorded decision, so a report differs from the recording only where a test
// scripts it with `decide`. It holds no policy logic and calls no model.
import type { MemoryEvent, Policy } from "../../src/schema.ts";
import type { Decision, Simulator } from "../../src/simulate.ts";

export interface FakeSimulatorOptions {
  /** The decision the candidate policy makes for an event; defaults to the recorded one. */
  decide?: (event: MemoryEvent, policy: Policy) => Decision;
}

export function createFakeSimulator({ decide }: FakeSimulatorOptions = {}): Simulator {
  return {
    async simulate(workload, policy) {
      const decisions = workload.events.map((e) => {
        const simulated = decide ? decide(e, policy) : e.decision;
        return {
          seq: e.seq,
          op: e.op,
          item_id: e.item_id,
          recorded: e.decision,
          simulated,
          reason: decide ? "scripted by the fake simulator" : e.reason,
          policy_id: decide ? `${policy.id}@${policy.version}` : e.policy_id,
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
