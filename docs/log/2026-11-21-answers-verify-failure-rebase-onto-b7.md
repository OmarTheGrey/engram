---
date: 2026-11-21
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/PINS.md
  - research/results/MANIFEST.md
  - "make lint"
supersedes: none
---

**What.** The verification fix pass's first gate run failed twice after main moved during it: one research test and `make lint`.

**Why.** Main gained R4's MANIFEST follow-up (#77) and B7 (#78) after the first rebase. `test_research_scripts.py` failed because the branch still held R4's pre-follow-up commit cell (`86af2a7`). After a second rebase, `tsc` failed on B7's new `@engram/server` import because the worktree's workspace links predated it. The automatic keep-both resolution of PINS.md also left two LongMemEval and two MERIT notes.

**Result.** A second rebase onto `origin/main` fixed the MANIFEST cell; PINS.md was hand-merged to one note per pin; `pnpm install --frozen-lockfile` relinked the workspace. Then `uv run pytest -q research` gave 498 passed and `make lint` exited 0.

**Consequence.** After a rebase the worktree is reinstalled before the gates, and a keep-both merge of notes is reread.
