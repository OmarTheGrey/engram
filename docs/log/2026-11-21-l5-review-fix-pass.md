---
date: 2026-11-21
author: claude-agent
type: change
card: L5
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/lint/near-duplicate.ts
  - packages/core/test/unit/lint/near-duplicate.test.ts
  - research/scripts/near_duplicate.py
  - "make test-one T=packages/core/test/unit/lint/near-duplicate.test.ts"
supersedes: none
---

**What.** The fix pass for card L5's review: three important and six minor findings (L5-1 to L5-9), each fixed test first.

**Why.** The review found two vetoes untested inside the pass, a length bound on words where the Jaccard bound is on shingle sets, and a quadratic pass on templated text, among smaller gaps.

**Result.** near-duplicate.test.ts has 46 tests (from 39). Deleting the rare-term veto line, the number veto line, the new length bound or the cap each fails a test. The catalogue's findings and the presets guard are unchanged; only the near-miss fixture's description changed. The result regenerates to sha256 76bd5a0b (MANIFEST commit ddbeb5e1).

**Consequence.** The superseding entries of this date record what each fix falsified.
