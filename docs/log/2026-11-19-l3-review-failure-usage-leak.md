---
date: 2026-11-19
author: claude-agent
type: failure
card: L3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/model.ts
  - packages/core/test/property/lint-leak.test.ts
supersedes: none
---

**What.** Review finding L3-2: a model lint event about a source outside the linted scope carried `usage`, whose input tokens give the source's length.

**Why.** The reason was withheld, but every member of the scope sees the event, and ADR 0009's post-merge amendment allows it nothing beyond what the linted item records. The reviewer saw 642 against 624 input tokens on two such events.

**Result.** The second lint-leak property now asserts that such a visible event has no usage; it failed on the old code, and passes now that the finding drops the usage when the source is outside the scope.

**Consequence.** The usage stays in `LintReport.judgments` and the runner's usage.json.
