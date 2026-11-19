---
date: 2026-11-19
author: claude-agent
type: failure
card: L2
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/faults/generate.ts
  - packages/bench/scripts/fault-set-check.ts
  - packages/bench/test/faults/generate.test.ts
supersedes: none
---

**What.** Review finding L2-2 on PR #46: in question `61f8c8f8` the source-changed near-miss (`...0903`) was a real duplicate of the source-changed fault (`...0584`).

**Why.** Two user turns shared a first sentence, so both quote notes had one text. The check missed it: `duplicate` was not among the lints it measured, and it ignored duplicate findings on unkeyed labels.

**Result.** The generator skips a source turn whose excerpt it has already quoted, and the check now fails on any finding, of any lint, on an injected item that no label expects. A test with turns sharing a first sentence quotes four distinct excerpts and finds no unexpected finding; it fails when the skip is removed.

**Consequence.** The earlier finding's 968 duplicates were 967 on base turns and 1 on this near-miss (superseding entry `2026-11-19-l2-review-finding-natural-faults`).
