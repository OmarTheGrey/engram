---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - packages/core/test/unit/dogfood-report.test.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Review finding E95-6 (important): a grant on an item whose provenance re-adoption raised was counted under `watch`, though the twin profile forbids exactly that grant.

**Why.** The first pass left the call to the lead; the coordinator decided it is a violation, and that adoption itself is fixed by its own card after card E2.6, which rewrites `adopt.ts`.

**Result.** Such a grant is now `grant_change` 1, through a planted event and through the real Plane, which accepts it. The backlog row "Adoption raises trust" carries the diagnosis and fix, and the procedure makes that fix a precondition of the start.

**Consequence.** Nothing in `adopt.ts` changes in this PR.
