---
date: 2026-10-22
author: fixture
type: failure
card: D2
chapter: limitations
pillar: distill
hypothesis: H5
evidence:
  - fixtures/sessions/s0-interception.jsonl
supersedes: none
---

**What.** Replay validation admitted a procedure that failed on held-out tasks.

**Why.** The replay set shared tasks with the induction set.

**Result.** The admitted procedure failed on the held-out session.

**Consequence.** Replay sets are disjoint from induction sets.
