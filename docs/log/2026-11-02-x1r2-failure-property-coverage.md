---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/core/test/property/read-pipeline.test.ts
supersedes: none
---

**What.** The first version of the core pipeline's property test let only 8 of 300 generated reads return items and the limit cut just 1, so it barely exercised ranking and the cut.

**Why.** Random policies, memberships and validity windows filter nearly every generated item.

**Result.** Readers now belong to some pool scopes and half the reads come after every item is valid, and a dense property (one permissive policy, every item readable) exercises the cut on more than 20 of 200 reads.

**Consequence.** Found while working the round-2 fix pass.
