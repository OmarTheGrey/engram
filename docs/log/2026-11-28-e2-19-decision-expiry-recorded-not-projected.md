---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.19
chapter: design
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/plane/approvals.ts
  - packages/core/src/policy/promotion.ts
supersedes: none
---

**What.** The projection marks a pending request past its expiry `due` and decides nothing; the expiry is recorded by `Plane.expireRequests`, a member's sweep of a scope, or by the deny the evaluator appends when that version is promoted after its expiry.

**Why.** Rule 3: an expiry is a decision, so it is an event. Core reads no clock, and nothing runs on a timer, as for `retain`.

**Result.** The property file checks that every expiry event is at or after its due time and that a final sweep leaves none due.

**Consequence.** A surface that wants expiries recorded calls the sweep (E8.8).
