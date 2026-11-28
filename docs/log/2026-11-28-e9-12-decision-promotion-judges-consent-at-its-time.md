---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.12
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - packages/core/src/policy/evaluate.ts
supersedes: none
---

**What.** The promotion gate passes its own time to the write check as `consentAt`, and a caller with no time judges every window as open; promotion.ts is outside the card's file list.

**Why.** evaluatePromotion calls evaluateWrite with no `at` (passing it would judge grant expiries too); without a time an Incognito window could not be judged, and an episode consolidated in a person scope is a first write.

**Result.** Unit test: an episodic item promoted to semantic in person:omar is refused inside an Incognito window and allowed after it; removing `consentAt` fails that test.

**Consequence.** One line in promotion.ts; no mutant names it.
