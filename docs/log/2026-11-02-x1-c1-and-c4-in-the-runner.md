---
date: 2026-11-02
author: claude-agent
type: change
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/config.ts
  - packages/runner/src/conditions.ts
  - packages/runner/src/gatemem-probe.ts
  - packages/runner/test/conditions.test.ts
  - packages/runner/test/x1-gatemem.test.ts
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
supersedes: none
---

**What.** The runner builds C1 and C4 beside C2, C3 and C5, from one condition table (`CONDITION_TABLE`): where memory comes from, whether the policy is text, whether read items carry metadata.

**Why.** H1's primary test is C4 minus C5, and H2 and H5 name C1; plan decision 4 ports both from GateMem (ADR 0031, proposed).

**Result.** C1 on GateMem has no store and no tool, and its prompts equal card B1's LongContextAgent's for the same checkpoint. C4 is C3's session plus a legend, and its read is C3's tag plus `speaker`, `speaker_role` and `access` per item. A test shows neighbours differ in one column each, and changing every hidden checkpoint field changes no C1 or C4 cache key.

**Consequence.** Card X1's suite runs every condition on both arms; PR 4 points v1's Conditions table at these code paths.
