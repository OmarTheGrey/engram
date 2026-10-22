# PX2 Session custom entries and replay

Status: open.

Added by ADR 0001.

Goal: the Engram log and the `engram.event` custom entries of a pi session reconstruct each other; a recorded session JSONL replays through the plane to the same decisions (the policy simulator's input).

Files: `packages/pi-extension/src/replay.ts`, `packages/core/src/simulate.ts`, `fixtures/sessions/`

Depends on: PX1, E1.3

Acceptance: replaying `fixtures/sessions/*.jsonl` through the plane yields their `.expected.json` decisions with zero model calls

Out of scope: the simulator CLI (E8.9).
