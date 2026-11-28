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
supersedes: none
---

**What.** Five mutants survive their invariant's test, each with a note in its fixture.

**Why.** A survivor is either code the invariant cannot see by design, redundant code, or a gap in the test.

**Result.** By design: `I1-status-ignored` (invariant 1 ignores status on purpose). Redundant: `I1H-store-delete-skipped` (the offboarding's closing sweep deletes the records anyway). Gaps: `I1H-erase-active-only` (the two-handle walk never checks that every item of the person scope was erased); `I9-link-ignores-previous` (every tamper the chain test injects is caught by the log's other checks, so nothing isolates the link's coverage of its predecessor); `I2-untrusted-confirms` (counting a model restatement as a confirmation is not caught by invariant 2's promotion walk; cause not established).

**Consequence.** For the lead: three test gaps in the owner's invariant file, each a candidate for a guard or a case; invariants.test.ts is the lead's file, so this card changes none of it.
