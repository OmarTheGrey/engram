---
date: 2026-11-28
author: claude-agent
type: failure
card: D4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** `make test-invariants` failed once: invariant 1's surface check found the new `revalidate` among the Plane's methods, unclassified.

**Why.** The check lists every Plane method so that each is shown to leak nothing to an actor who cannot read the item ("a new Plane method must be classified here"). Adding the method without classifying it is exactly what it catches.

**Result.** `revalidate` is classified: the outsider's re-validation of a hidden item carries no content, names no scope, and its event equals that for an id the log never held once ids are neutral. Rerun: 3 files, 21 of 21 tests pass.

**Consequence.** None beyond the classification.
