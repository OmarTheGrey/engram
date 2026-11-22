---
date: 2026-11-22
author: claude-agent
type: change
card: E2.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/who-can-read.ts
  - packages/core/test/property/who-can-read.test.ts
  - packages/core/test/property/invariants.test.ts
  - make test-one T=packages/core/test/property/who-can-read.test.ts
  - make test-invariants
supersedes: none
---

**What.** The review's six findings, fixed tests first. E2.13-1: a member asking about a closed item gets no owner and no instant. E2.13-2: a test that the answer is judged at the log's head. E2.13-3: the agreement test checks `closed`, validity included. E2.13-4: a non-owner's grants carry no position. E2.13-5: the invariants surface check asserts no trace of `person:s` and compares the scope refusal in full with an empty scope's, additive only. E2.13-6: a complete list of what the answer reveals.

**Why.** Two important and four minor findings of the review of the branch.

**Result.** The leak property failed before the E2.13-1 and -4 fix and passes after; both surviving mutations now fail tests. who-can-read 6 of 6, invariants 17 of 17.

**Consequence.** Three entries superseded; the leaks outside the card are recorded for the lead.
