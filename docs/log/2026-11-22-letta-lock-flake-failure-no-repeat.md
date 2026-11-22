---
date: 2026-11-22
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - "pnpm exec vitest run packages/adapters/test/letta/repository.test.ts -t \"four openers\" --repeat=4"
supersedes: none
---

**What.** The first reproduction attempt, repeating the M-2 test inside one vitest run, did not start.

**Why.** Vitest 5.0.5 has no `--repeat` flag: it exited with `CACError: Unknown option --repeat`.

**Result.** The loop starts a separate vitest process per run instead, four at a time, with `pnpm exec vitest run packages/adapters` alongside each batch as load (the command in the change entry of 2026-11-22).

**Consequence.** Nothing in the code.
