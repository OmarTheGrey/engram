---
date: 2026-11-25
author: claude-agent
type: decision
card: L8
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/det.ts
  - packages/core/test/unit/plane/lint-read-filter.test.ts
  - packages/core/test/unit/lint/near-duplicate-presets.test.ts
supersedes: docs/log/2026-11-25-l8-decision-supersession-exemption.md
---

**What.** At the default reach, orphan treats an item the filter refuses as present in two cases, both only within the linted scope:
- the item is refused only on time (`LintContext.dated`);
- a lineage id names an item retired by its own supersession.

Neither item is ever named or described. A dated source still raises no source-changed.

**Why.** The lead's decisions on L8-3 and L8-4. A dated source is not gone. The old exemption ran on a grant into another scope, so a missing orphan finding revealed that item's retiring rule.

**Result.** The registered reach keeps L1's behaviour. near-duplicate-presets' default difference is unchanged: under medium 1 run differs in findings and 20 in wording only; under strict, 2 and 19.

**Consequence.** At the default reach a superseded predecessor in another scope reads as absent. The registered reach keeps the old side channel until the tag.
