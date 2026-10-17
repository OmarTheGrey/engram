// The extension does not decide policy (AGENTS.md rule 1). It asks an injected
// gate and records the answer. Plane.write and Plane.read replace the stub gate
// once packages/core implements them (card PX1).

export interface GateRequest {
  op: "write" | "read";
  tool: string;
  input: Record<string, unknown>;
}

export interface Decision {
  decision: "allow" | "deny";
  reason: string;
  policy_id: string;
}

export type Gate = (request: GateRequest) => Decision;
