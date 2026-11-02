---
date: 2026-11-02
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/mem-inv-admission.ts
  - packages/runner/scripts/mem-inv-admission.ts
  - packages/runner/test/research/mem-inv-admission.test.ts
supersedes: docs/log/2026-11-02-pr2-mem-inv-admission-entry-point.md
---

**What.** The MEM-INV-Bench admission entry point as it stands after both review rounds.

**Why.** Its first-pass entry described only the marked entries.

**Result.** `admissionOf` is unchanged; `labelAdmission` now returns the unmarked entries (an attack's trusted filler) beside the marked ones, each with its scope, so the result can say what the operator's read holds at all. A test requires that under strict every `team:operations` entry waits as a candidate.

**Consequence.** None.
