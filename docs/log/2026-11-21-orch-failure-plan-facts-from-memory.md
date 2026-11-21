---
date: 2026-11-21
author: claude-orchestrator
type: failure
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/absorb-plan.md
  - packages/bench/PINS.md
  - docs/tasks/E8.10.md
  - docs/tasks/E8.11.md
supersedes: none
---

**What.** The first draft of the absorb plan and its cards stated four things from memory that the repository contradicted or could not support.

**Why.** The drafts were written from the research's summaries before the files were read.

**Result.** Corrected before commit: MERIT's licence was called unconfirmed, and `packages/bench/PINS.md` pins it under MIT; card E8.11 called card E8.10 merged, and its file says open; a count of tests and a model's weight size were stated with no source and were removed; the roadmap's new table first used invented Python-style paths, replaced by the real ones.

**Consequence.** Each card's facts about the repository were checked against the files in this PR. The research's own claims about our code stay marked as read, not run, in `docs/research/absorb/README.md`.
