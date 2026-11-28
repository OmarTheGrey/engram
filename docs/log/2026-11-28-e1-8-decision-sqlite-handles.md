---
date: 2026-11-28
author: claude-agent
type: decision
card: E1.8
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/model/replay.ts
supersedes: none
---

**What.** The handles are SQLite connections to one file, not Postgres.

**Why.** The protocol's ordering is the log's lock, which both backends give (ADR 0024), and the replay drives about 12,000 steps; embedded Postgres would add a worker round trip per statement.

**Result.** Three connections plus one per stopped offboarding's restart, each through a Db wrapper that kills the handle at `obStop`, as `test/helpers/failpoint.ts`'s crash does.

**Consequence.** Cost if wrong: a Postgres-only ordering difference is not replayed; the Db contract tests cover the backends' equivalence.
