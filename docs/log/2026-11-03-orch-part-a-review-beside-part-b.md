---
date: 2026-11-03
author: claude-orchestrator
type: decision
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-table.json
  - research/results/h1-cost.json
  - packages/runner/src/research/h1-sessions.ts
supersedes: none
---

**What.** An independent review of part A ran while part B wrote the v1 text. Part A fixed the findings on its own branch, part B was rebased onto the fixes, and part B then replaced its placeholders with the fixed numbers.

**Why.** Part B's text rests on part A's numbers and definitions, so a review after part B would have meant rewriting both. Running it beside part B and telling part B which definitions would change kept the text on the fixed design from the start.

**Result.** The review found one critical defect (MEM-INV-Bench's UNREAD and MALFORMED replies counted as safe) and three important ones (six models priced without their reasoning, an anchored label audit, a weak end-to-end test). The rebase met one conflict, in `research/configs/h1-table.json`, resolved by keeping part A's fixed file with part B's store, `mem0`.

**Consequence.** The whole of PR 4 goes to a final verifier.
