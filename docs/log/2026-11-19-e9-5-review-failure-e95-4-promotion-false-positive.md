---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
  - packages/core/src/dogfood.ts
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** Review finding E95-4 (critical): a promotion the real plane allows was counted as a violation.

**Why.** The owner grants an episodic item to a teammate and a reviewer promotes it; the new semantic version carries the episodic grant, switched off, and the report flagged any grant change not made by the owner.

**Result.** Only a widening (`grantsWiden`: a new grant, a longer expiry, a class change switching a grant on) by anyone but the owner is a violation; a narrowing by someone else is counted under `watch.narrowed`. A real-Plane test with promotions, retention and an offboarding gives 0 violations and `narrowed` at least 1, while a handover or promotion bringing back a removed grant still gives 1.

**Consequence.** A finding and a backlog row record the disagreement with ADR 0034, decision 6.
