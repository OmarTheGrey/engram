// The Simulator interface (docs/architecture.md "Interfaces", ADR 0001):
// replay a recorded workload under a candidate policy and report which
// decisions would change, with zero model calls. A pi session reaches it
// already converted to events by packages/pi-extension, so core needs no pi
// type. The implementation is card E8.9.
import type { MemoryEvent, Policy } from "./schema.ts";

export type Decision = MemoryEvent["decision"];

/** A recorded workload: the events of a run or of a converted pi session, in seq order. */
export interface Workload {
  id: string;
  events: MemoryEvent[];
}

/** One recorded decision next to the one the candidate policy makes. */
export interface SimDecision {
  seq: number;
  op: MemoryEvent["op"];
  item_id: string | null;
  recorded: Decision;
  simulated: Decision;
  /** Why the candidate policy decided as it did. */
  reason: string;
  /**
   * The id of the rule that decided, in the format of MemoryEvent.policy_id:
   * a rule of the candidate policy (such as `<policy id>/write/<level>` or
   * `<policy id>/read/<level>`) or a plane rule (such as
   * `engram/write/membership`). It is never the policy's own id; that is
   * SimReport.policy_id.
   */
  policy_id: string;
}

export interface SimReport {
  workload_id: string;
  /** The id of the candidate policy the workload was replayed under. */
  policy_id: string;
  policy_version: number;
  decisions: SimDecision[];
  /** Simulated decisions by kind. */
  totals: Record<Decision, number>;
  /** How many simulated decisions differ from the recorded ones. */
  changed: number;
  /** The simulator never calls a model. */
  model_calls: 0;
}

export interface Simulator {
  simulate(workload: Workload, policy: Policy): Promise<SimReport>;
}
