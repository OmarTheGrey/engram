---
date: 2026-11-21
author: claude-agent
type: finding
card: L5
chapter: discussion
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-near-duplicate.json
  - fixtures/faults/duplicate.near-miss.json
supersedes: none
---

**What.** With the tier enabled, the `duplicate` near-miss fixture's lower-cased copy of the freeze sentence is a near-duplicate, the one unlabelled finding on the catalogue.

**Why.** The exact lint keeps case apart by design (ADR 0018, strict form); the tier folds case.

**Result.** 1 finding over the 14 fixtures of other lints (`unlabelled_findings` in the result). The many "fault fixture fact n" pairs reach the threshold and are stopped by the number veto.

**Consequence.** When arm P4 is registered, its audit should expect case-only restatements among the tier's findings.
