---
date: 2026-10-25
author: claude-agent
type: failure
card: B1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/gatemem/schema.ts
  - packages/bench/scripts/check-gatemem-upstream.ts
supersedes: none
---

**What.** The first strict GateMem checkpoint schema, written from the medical domain's fields, rejected office checkpoint line 106 when the full upstream dataset was loaded.

**Why.** 23 office checkpoints carry `attack_type` inside `judge_spec` as well as at the top level; the fixture's 20 checkpoints have none of them, so the fixture tests passed.

**Result.** `JudgeSpec` now admits an optional `attack_type`; the whole dataset (2,218 checkpoints) loads. The field sits inside the hidden `judge_spec`, so the stripping was never at risk.

**Consequence.** Field inventories are taken over every domain's full file before a schema is called strict.
