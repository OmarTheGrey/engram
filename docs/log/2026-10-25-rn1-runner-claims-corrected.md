---
date: 2026-10-25
author: claude-agent
type: change
card: RN1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/pi-extension/src/tools.ts
  - packages/runner/test/conditions.test.ts
  - packages/runner/src/run.ts
  - docs/architecture.md
  - docs/decisions/0017-cached-metered-seeded-model-calls.md
supersedes: docs/log/2026-10-25-rn1-sdk-runner.md
---

**What.** Corrects two RN1 claims: that C2, C3 and C5 differed only in mechanism, and the architecture's sentence that model calls are metered into the event log.

**Why.** C5's tool descriptions and write results told the model a policy decides (finding R7-5), and the runner metered into a UsageRecord list only.

**Result.** All three conditions now declare byte-identical tools from one definition, tested (decision D13); C5 differs by the Plane's reasons and the memory tag. Usage goes to usage.json beside the results, which no longer carry call counts, so a recording run and a replay write identical results (finding R7-10). The architecture now says so. The rest of the earlier entry stands; its call counts are unchanged at 6 then 0.

**Consequence.** Whether the tag is mechanism or prompt is for the lead before any H1 run (ADR 0015).
