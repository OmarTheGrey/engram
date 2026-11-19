---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/oracle-grants.test.ts
supersedes: none
---

**What.** Two of the new oracle unit tests passed `undefined` as the prior version to a helper whose parameter defaulted to an item, so they judged the wrong case.

**Why.** A JavaScript default parameter replaces an explicit `undefined`.

**Result.** One of them failed for that reason; both now call `grantChangeProblem` directly with `undefined`, and pass for the case they name.

**Consequence.** Test helpers with defaults are not used for the case the default replaces.
