---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15a
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/registry.ts
supersedes: none
---

**What.** "Did you mean" uses optimal string alignment distance, at most 2 and less than the length typed, the first match in registry order on a tie.

**Why.** 12.2 says edit distance 2. Counting a swap as one edit catches `raed` and `--protcet`; without the length bound `--id` on read would suggest any two-letter flag.

**Result.** `closest` and its cases are unit tested in the registry test.

**Consequence.** A two-letter typo with two edits gets no suggestion; the first line already names it.
