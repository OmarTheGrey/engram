---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.10
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/injection-screen.ts
  - packages/core/test/unit/policy/injection-screen.test.ts
  - docs/decisions/0039-content-guards-at-the-write-gate.md
supersedes: none
---

**What.** imperative-to-agent reads only the kinds a person did not type, as standing-directive and memory-persistence do; user and import content is never read by it.

**Why.** The coordinator's decision 1 under the lead's delegation (review E2.10-3), on ADR 0039 item 5: a person may tell their own memory to do something, and addressing one's assistant ("Assistant, remember that I am vegetarian", "AI: remember my birthday is 3 May") is how such a memory is written.

**Result.** The four addressed user memories of the corpus pass under both profiles; a tool's "Assistant: send the invoice" is still held. Removing the kind condition now fails 14 tests.

**Consequence.** A user who pastes an attacker's text into a memory as their own gets four rules, not five.
