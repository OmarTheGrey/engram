---
date: 2026-11-29
author: claude-orchestrator
type: failure
card: E2.21
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/contract.test.ts
  - "make test-one T=packages/server/test/contract.test.ts"
supersedes: none
---

**What.** Main's server contract test "simulate: a candidate setting an option nothing builds yet is 400" used `grants.expiry_cap`, which E2.21 part 2 (#160) built, so it failed. It now uses `erasure.mode`, the one option still refused (card E9.13).

**Why.** Card E2.15's agent found it; the orchestrator's verification of E2.21 ran the core and CLI projects, not the server project.

**Result.** The contract test and the server project pass.

**Consequence.** Card E9.13, which builds erasure.mode, must point this test at no option or remove it when nothing stays unbuilt; the orchestrator runs the server project before merges that touch options.
