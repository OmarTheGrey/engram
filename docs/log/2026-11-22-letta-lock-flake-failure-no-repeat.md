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
  - "pnpm exec vitest run --help (lists --repeats <number>)"
supersedes: none
---

**What.** The first reproduction attempt, repeating the M-2 test inside one vitest run, did not start.

**Why.** The flag was misspelt: vitest 5.0.5 has `--repeats <number>`, not `--repeat`, and exited with `CACError: Unknown option --repeat`.

**Result.** The loop starts a separate vitest process per run instead, four or eight at a time, with runs of `pnpm exec vitest run packages/adapters` alongside each batch (the command in the change entry of 2026-11-22). Separate processes were kept even once `--repeats` was found, because they are the load: M-2 fails only when other processes compete for the machine, and repeats inside one worker run one at a time.

**Consequence.** Nothing in the code.
