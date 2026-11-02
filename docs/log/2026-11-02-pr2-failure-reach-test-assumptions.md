---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/research/gatemem-reach.test.ts
  - fixtures/bench/gatemem/manifest.json
supersedes: none
---

**What.** The first run of the reach tests failed twice on wrong assumptions about the GateMem fixture, not on the code.

**Why.** The test expected 12 access and forgetting checkpoints in the fixture and that the Moonstone contractor (office checkpoint 11) had spoken before her as-of turn.

**Result.** The fixture holds 14 such checkpoints (education 4, household 3, medical 3, office 4), and the contractor has no turn before checkpoint 11, so the test now requires that any own turn be readable and that at least one granted turn reach her. The other three tests passed on the first run.

**Consequence.** None.
