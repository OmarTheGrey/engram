---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - packages/core/test/property/cedar.test.ts
supersedes: none
---

**What.** The export was drafted before its differential test, against the testing convention's acceptance test first.

**Why.** The request encoding the test calls had to be designed with the export, since Cedar cannot iterate and the grant and time encodings decide what the test can claim.

**Result.** The test was never seen failing for want of the export. To compensate, eight mutations of the export were run against it: seven were caught, each by at least one agreement property, and the eighth was an equivalent mutant, now removed (`2026-11-21-e2-12-finding-expiry-bound-unobservable.md`).

**Consequence.** The mutation results stand in for the red step; a reviewer may ask for more mutants.
