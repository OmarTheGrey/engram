---
date: 2026-11-20
author: claude-agent
type: failure
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/src/extension.ts
  - packages/pi-extension/test/attacks.test.ts
supersedes: none
---

**What.** Review of PR #59, RV5-1: the pi extension exempted a tool from the no-bypass checks by its name only, so another extension loaded before Engram's that registered `memory_read` with a `path` argument wrote into a store root unchecked (the reviewer's `ran=1 planted=true`).

**Why.** pi keeps the first tool registered under a name; the name says nothing about whose tool runs.

**Result.** Reproduced red by the new attacks.test.ts cases for a shadowing `memory_read` and `memory_write`; fixed by the identity check (decision entry rv5-fix-decision-identity-by-schema).

**Consequence.** The exemption now holds for this extension's own definitions only.
