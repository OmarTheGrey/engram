# RN1 SDK experiment runner

Status: open; the scripted, cached and pi-ai model calls exist since S0.10.

Added by ADR 0001.

Goal: run benchmark items as pi SDK sessions (`createAgentSession` with `SessionManager.inMemory()`), with the Engram extension loaded or not by condition, the model chosen by config, seeds from config and every call through the cache; the runner emits `user_bash` itself for user commands (S0.5 finding).

Files: `packages/runner/src/`, `packages/runner/test/`, `research/configs/`

Depends on: PX1, S0.10

Acceptance: a config runs one GateMem probe under C2, C3 and C5; a rerun with the same config makes zero new model calls (roadmap X1)

Out of scope: Pi Durable (RN2).
