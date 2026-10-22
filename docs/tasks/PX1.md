# PX1 Engram pi extension skeleton on the plane

Status: open; step-0 task S0.5 proved the interception points with a test-only stub gate.

Added by ADR 0001.

Goal: replace the injected stub gate with `Plane.write` and `Plane.read`; tools `memory_write`, `memory_read`, `memory_explain`, `memory_simulate`; the write gate in `tool_call`, the read filter in `context` and `before_agent_start`; every decision a MemoryEvent in the Engram log and an `engram.event` custom entry; store commands blocked in `user_bash` and in the bash `tool_call`.

Files: `packages/pi-extension/src/`, `packages/pi-extension/test/`, `fixtures/sessions/`

Depends on: E2.2, E2.3, S0.5

Acceptance: `pnpm --filter pi-extension test`: a write the policy forbids is blocked in a pi SDK session and the same event appears in the Engram log and in the session (Gate A check)

Out of scope: the pi package and its distribution (PX3).
