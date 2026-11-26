---
date: 2026-11-26
author: claude-agent
type: failure
card: X21
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_h1_pipeline.py
  - pnpm install --frozen-lockfile --prefer-offline
supersedes: none
---

**What.** Three tests of `research/tests/test_h1_pipeline.py` failed on the first run in the fresh worktree.

**Why.** They shell out to `node packages/runner/scripts/h1-sessions.ts`, which exited 1 (`CalledProcessError` on `--help`) because the worktree had no `node_modules` yet.

**Result.** After `pnpm install --frozen-lockfile --prefer-offline` all 39 tests of the H1 pytest files passed, the change unaltered. The API connection also dropped once mid-step; the uncommitted edits survived and were committed as a WIP step.

**Consequence.** Install before running the research tests in a new worktree; no code change.
