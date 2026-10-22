# RN2 Durable runner behind a flag

Status: open.

Added by ADR 0001; experimental upstream.

Goal: the same runs as RN1 on Pi Durable (`Harness`, `defineTask`) for checkpointed, parallel runs, only when `ENGRAM_RUNNER=durable`.

Files: `packages/runner/src/durable/`

Depends on: RN1

Acceptance: the RN1 config under `ENGRAM_RUNNER=durable` produces the same results file hash after a forced restart mid-run

Out of scope: any dependency on Pi Durable outside `packages/runner` (AGENTS.md).
