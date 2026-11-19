---
date: 2026-11-19
author: claude-agent
type: finding
card: E9.5
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
  - docs/tasks/backlog.md
supersedes: none
---

**What.** `Plane.promote` carries the source's grants onto a promotion's new version, which a reviewer who is not the owner may make, while ADR 0034's decision 6 holds a class change of an item carrying grants to its owner with every kept grant of the new class.

**Why.** Review finding E95-4 surfaced it: the first pass followed the ADR and flagged a promotion the plane allows.

**Result.** A real-Plane test: an episodic item with an episodic grant, promoted by a reviewer, lands semantic with the episodic grant, which no longer admits a read.

**Consequence.** A backlog row for the lead ("Promotion carries grants"): drop grants of another class on promotion, or amend the ADR.
