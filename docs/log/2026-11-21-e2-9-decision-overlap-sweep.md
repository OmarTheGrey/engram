---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
supersedes: docs/log/2026-11-21-e2-9-decision-overlap.md
---

**What.** Overlaps resolve by sort and sweep: findings sorted by start split into clusters that overlap, and only inside a cluster is the greedy choice by rank made (a deciding match first, then the BLOCK tier, then table order). The scan stops at the first match that decides the write.

**Why.** The superseded choice compared each finding with every kept one, quadratic in the findings (E2.9-1), and a non-deciding match could displace a deciding one.

**Result.** 149,796 emails in 1M characters resolve in 273 ms; a test pins that a deciding pii match is kept over an overlapping secret.

**Consequence.** A reason that stops early names one match; the five-match reason now needs a scan that nothing decides.
