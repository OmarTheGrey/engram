---
date: 2026-11-28
author: claude-agent
type: finding
card: X16
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - research/results/h1-gate-mutation-audit.json
  - fixtures/mutants/
supersedes: docs/log/2026-11-28-x16-finding-five-survivors.md
---

**What.** Two mutants survive their invariant's test after the review.

**Why.** The first run's finding called `I2-untrusted-confirms` uncaused and `I1H-store-delete-skipped` redundant. The review found both readings wrong.

**Result.**
- `I2-untrusted-confirms` had a cause. A model, compaction or external confirmer lowers the promoted item's trust, so the target's write rule refuses it. Only an `import` restatement could slip through, and the walk drew one too rarely. A fixed case now kills it.
- `I1H-store-delete-skipped` is not redundant. The closing sweep makes up the store, but the log gains one swept event per record and the report's deleted list is short, which invariant 1 does not check. The offboarding acceptance test now kills it.
- `I1-status-ignored` survives by design.

**Consequence.** No invariant gap remains among the frozen set.
