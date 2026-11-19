---
date: 2026-11-19
author: claude-agent
type: decision
card: L4
chapter: design
pillar: research
hypothesis: H3
evidence:
  - research/configs/h3-lint-floor.json
  - research/scripts/h3_lint_floor.py
supersedes: none
---

**What.** The floor does not read L2's audit sheet; its config names a judged sheet (`audit_sheet`, null now), and until one is named the result says the audit is unjudged.

**Why.** The sheet lives under .engram/ on one machine; a result that read it would not reproduce elsewhere (rule 9). Where judged readings are committed, and in what form, is for the card that judges them.

**Result.** Naming a sheet raises until that card implements it.

**Consequence.** Precision on natural memory stays a bound, 0.721 to 1.0.
