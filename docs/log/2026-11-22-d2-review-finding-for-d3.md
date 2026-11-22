---
date: 2026-11-22
author: claude-agent
type: finding
card: D2
chapter: discussion
pillar: distill
hypothesis: H5
evidence:
  - packages/runner/src/induce.ts
  - packages/core/src/policy/evaluate.ts
supersedes: docs/log/2026-11-21-d2-finding-for-d3.md
---

**What.** Candidates still cannot be read back through `Plane.read`, so card D3 takes them from `runInduceConfig`'s `items` or `candidates.jsonl`. The fixture's ids changed with the control.

**Why.** Card D3 merged this branch, and its cassettes key on skill names.

**Result.** AWM: `01920000-0000-7000-8000-000000000001` to `...0003`, unchanged. Control: `...0007` to `...0016`, one per kept session, named by its instruction, for example `rename-parserow-to-parserecord-everywhere` with ref `distill:rule:cd38e0d4-3e62-4dc2-b801-dcf42945e1d9` (`d1-01`). `call-read-then-read` is gone.

**Consequence.** D3 re-records.
