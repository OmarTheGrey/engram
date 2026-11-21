---
date: 2026-11-21
author: claude-agent
type: change
card: R2
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - docs/log/2026-11-21-answers-decision-cap-in-billed-dollars.md
supersedes: none
---

**What.** I rebased card R2 onto main after the answers card merged (PR #80), and rechecked the proposals' costs against the merged Models section.

**Why.** The answers card's last pass added a programme-wide cap in billed dollars (lead-decisions item 59), and the spend ceilings are in ledger dollars.

**Result.** The rebase replayed the four R2 commits without a conflict. The list-price high estimates the bounds scale from are unchanged: 3.72 (MEM-INV-Bench), 1,248.21 (GateMem), 162.75 and 164.61 (LongMemEval). Every bound stands. The Cost rule now says the bounds are in the cap's billed dollars, not the ceilings' ledger dollars. Against main, the pre-registration diff is one hunk inside "Proposed amendments, not yet registered", additions only.

**Consequence.** Nothing else changes.
