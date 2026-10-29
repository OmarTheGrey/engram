# RN1 SDK experiment runner

Status: done in PR #7 (merged 2026-10-29); the acceptance test is packages/runner/test/run.test.ts and the acceptance command is `ENGRAM_OFFLINE=1 make run CONFIG=research/configs/rn1-gatemem-probe.json`, run twice (it reports zero new model calls). Paths used: `packages/runner/src/`, `packages/runner/test/`, `packages/runner/scripts/run.ts`, `research/configs/rn1-gatemem-probe.json` (a pipeline config, not a registered experiment), `fixtures/bench/gatemem/rn1-probe-script.json`, `fixtures/cassettes/rn1-gatemem-probe/`.

Added by ADR 0001.

Goal: run benchmark items as pi SDK sessions (`createAgentSession` with `SessionManager.inMemory()`), with the Engram extension loaded or not by condition, the model chosen by config, seeds from config and every call through the cache; the runner emits `user_bash` itself for user commands (S0.5 finding).

Files: `packages/runner/src/`, `packages/runner/test/`, `research/configs/`

Depends on: PX1, S0.10

Acceptance: a config runs one GateMem probe under C2, C3 and C5; a rerun with the same config makes zero new model calls (roadmap X1)

Out of scope: Pi Durable (RN2).
