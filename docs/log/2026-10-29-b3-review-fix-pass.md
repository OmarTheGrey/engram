---
date: 2026-10-29
author: claude-agent
type: change
card: B3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/live.ts
  - packages/runner/test/live.test.ts
  - packages/runner/test/b3.test.ts
  - docs/decisions/0030-gatemem-principals-as-scopes-and-grants.md
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Fixed review findings R5-1 to R5-10 of PR 5 (card B3).

**Why.** The docs understated two limits of the mapping (no forgetting; access widened by symmetric and whole-speaker grants), and the live guards and tests had gaps.

**Result.** ADR 0030 restates decision 6, cites the forgetting gap and corrects the type count to 90. Three backlog items were added. Live cassettes now go only under `.engram/` or outside the repository, and `liveOptions` refuses offline again. `REPLAY=1` replays a live run offline. Spawned tests use no provider key and a faux model id. A C5 ingestion write that is not allowed now fails the probe. Masked events now keep their items. A runner test changes the hidden fields and finds identical prompts, writes and cassette hits. Mutation checks: 1, 2, 1 and 3 failing tests.

**Consequence.** RN1 and B3 cassettes are unchanged; both replay with zero new calls.
