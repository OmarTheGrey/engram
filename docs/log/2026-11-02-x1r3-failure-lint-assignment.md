---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/scripts/c4-walk-lengths.ts
  - "make lint"
supersedes: none
---

**What.** `make lint` failed on the round-3 C4 length script: an assignment inside an expression (`const row = (byType[t] ??= {...})`), the same pattern round 2's floor script was fixed for.

**Why.** Biome's formatter ran on the file but its linter did not, until the full gate.

**Result.** The assignment is its own statement; the script's output is unchanged apart from the fields added the same round, and `make lint` passes.

**Consequence.** New scripts get `pnpm exec biome check` (lint as well as format) before they are committed.
