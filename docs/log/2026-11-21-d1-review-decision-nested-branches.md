---
date: 2026-11-21
author: claude-agent
type: decision
card: D1
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/episode.ts
  - packages/core/test/unit/distill/episode.test.ts
supersedes: none
---

**What.** Each entry off the final branch belongs to exactly one abandoned branch: the first one, taking leaves in file order, whose path reaches it. A later branch that forks inside an earlier one is left at that fork, and `left_from` gives the earlier branch's index. A branch whose entries give no step claims nothing.

**Why.** The review found two nested branches both left at the final branch, repeating their shared prefix, which card D2 would count twice. Forking at the deepest ancestor with another child alone would leave a shared entry in no branch.

**Result.** The nested tests in core and in the pi shapes pass, and no step id repeats across branches. Removing the claim fails both core tests.

**Consequence.** File order decides which branch owns a shared prefix. If wrong, D2's attempt boundaries shift; no step is lost or doubled.
