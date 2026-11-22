---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.12
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/cedar.test.ts
supersedes: none
---

**What.** Agreement is required on more than allow and deny: the deciding Engram rule id must be among the `@engram` ids of Cedar's reasons, a second action `write_without_review` must match the evaluator's "admit", Cedar must report no evaluation error, and generated policies with duplicated rules are tested beside the presets.

**Why.** The card asks for decisions only. A deny for the wrong reason would pass a decision check, and Cedar skips a policy whose condition errs, which could hide a forbid. Duplicate rules test that the export takes the first of each, as the evaluator's `find` does.

**Result.** All pass. The rule check is skipped only for a read no permit admits, which Cedar denies with no policy to name.

**Consequence.** The test runs about 17 seconds; if the lead wants it shorter, the generated-policy property can drop runs first.
