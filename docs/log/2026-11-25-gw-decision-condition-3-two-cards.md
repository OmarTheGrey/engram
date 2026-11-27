---
date: 2026-11-25
author: claude-agent
type: decision
card: X20
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/X20.md
  - docs/tasks/X21.md
  - packages/runner/src/research/h1-sessions.ts
supersedes: none
---

**What.** Pre-tag condition 3 is split into two cards: X20 (item 14, the runner records a refused answer call) and X21 (item 15, the H1 table counts capped utility sessions).

**Why.** The halves touch different code, the runner's probes and cassette in TypeScript against the analysis in Python, so two agents can work them at once with four days left. They share one file, the H1 converter (`packages/runner/src/research/h1-sessions.ts`), in separate functions.

**Result.** Neither depends on the other; whichever merges second rebases.

**Consequence.** Condition 3 holds only when both have merged.
