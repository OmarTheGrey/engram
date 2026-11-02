---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
  - packages/runner/src/mem-inv-probe.ts
supersedes: none
---

**What.** MEM-INV-Bench's C4 keeps the plan's metadata, each item's channel and provenance kind, and carries no access verdict.

**Why.** On this arm the plane decides at the write gate as well as the read filter, so a verdict faithful to C5 would need both; under H1's preset every entry is admitted, so the verdict would read allowed for every item and add nothing.

**Result.** A MEM-INV-Bench config refuses `c4_verdicts` and `judge`.

**Consequence.** ADR 0031 lists it among the lead's decisions.
