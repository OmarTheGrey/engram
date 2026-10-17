// Test-only gate for the S0.5 interception proof. Policy belongs in packages/core
// (AGENTS.md rule 1), so this lives beside the tests, not in src.
import type { Gate } from "../src/gate.ts";

/**
 * Step-0 task S0.5 stub: denies writes to org scope, allows everything else.
 * It exists only to prove the interception points; it is not a policy.
 */
export const stubGate: Gate = (request) => {
  if (request.op === "write" && request.input.scope === "org") {
    return {
      decision: "deny",
      reason: "org scope is not writable from an agent session",
      policy_id: "stub.org-write-denied",
    };
  }
  return request.op === "write"
    ? {
        decision: "allow",
        reason: "the stub gate allows writes outside org",
        policy_id: "stub.allow",
      }
    : { decision: "allow", reason: "the stub gate allows reads", policy_id: "stub.allow" };
};
