---
date: 2026-11-28
author: claude-agent
type: decision
card: X16
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/configs/gate-mutation-audit.json
supersedes: none
---

**What.** The audit's runs set `ENGRAM_PG=skip` and `ENGRAM_OFFLINE=1`, so the chain invariant's test runs on SQLite alone, and no run starts an embedded Postgres.

**Why.** Core's vitest project starts one embedded Postgres per run unless told to skip; with about 45 runs that is minutes of start-up and a server per run on a shared machine. The mutants are in code above the `Db` interface, which the backend does not change; the Postgres case of the chain test runs in `make test` and `make test-invariants` as before.

**Result.** Every run selected exactly one test, the SQLite one for `I9`.

**Consequence.** A bug that only the Postgres backend would show is outside the audit. If that matters, a second invariant row for the Postgres case can be added.
