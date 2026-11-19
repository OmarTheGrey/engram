---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.5
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
supersedes: none
---

**What.** A grant change counts as a violation of who may make it only when it widens what the grants admit; a narrowing by anyone else is counted under `watch.narrowed`.

**Why.** The coordinator's instruction for E95-4: the plane's promotion carries a grant its new class switches off, and nothing is wrongly admitted.

**Result.** `grantsWiden`: a grant of the new version that admits its class widens unless a grant of the version before, admitting that version's class, names the same principal or a pattern covering it and lasts at least as long.

**Consequence.** A narrowing is still judged by what it adds and carries.
