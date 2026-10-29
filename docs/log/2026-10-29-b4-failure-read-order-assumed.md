---
date: 2026-10-29
author: claude-agent
type: failure
card: B4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/bench/test/mem-inv-bench/plane.test.ts
  - packages/core/src/plane/read.ts
supersedes: none
---

**What.** A B4 test expected the action-time `Plane.read` to return a case's memory in upstream's write order, and failed.

**Why.** Upstream shows the model its memory as written; the plane ranks what it admits, and on the fake store the later entry came first.

**Result.** The test now compares the admitted contents as a set, with a comment saying the plane ranks; ADR 0029's amendments record that the order of memory shown under C5 differs from upstream's.

**Consequence.** Order of memory in the prompt is a difference between the plane's conditions and upstream's protocol that a live run should report.
