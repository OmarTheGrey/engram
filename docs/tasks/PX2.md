# PX2 Session custom entries and replay

Status: done on branch `px2-session-replay`, stacked on `e8-9-simulator` (ADR 0032) and `schema-v1`. Paths: `packages/pi-extension/src/replay.ts` (reading a session, its workload, its log, its replay), the `engram.policy` and `engram.call` entries in `packages/pi-extension/src/extension.ts`, the `bypass` step and `replayWorkload` in `packages/core/src/simulate.ts` and `packages/core/src/plane/simulate.ts`, the regenerated `fixtures/sessions/*.jsonl`, and the acceptance `packages/pi-extension/test/replay.test.ts`.

Added by ADR 0001.

Goal: the Engram log and the `engram.event` custom entries of a pi session reconstruct each other; a recorded session JSONL replays through the plane to the same decisions (the policy simulator's input).

Files: `packages/pi-extension/src/replay.ts`, `packages/core/src/simulate.ts`, `fixtures/sessions/`

Depends on: PX1, E1.3

Acceptance: replaying `fixtures/sessions/*.jsonl` through the plane yields their `.expected.json` decisions with zero model calls

Out of scope: the simulator CLI (E8.9).
