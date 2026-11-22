---
date: 2026-11-21
author: claude-agent
type: change
card: E2.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/counterexamples/trust.test.ts
  - "make test-one T=packages/core/test/counterexamples/trust.test.ts"
supersedes: none
---

**What.** Each characterisation case of card E2.7 gains its counterpart under the trust options, the same case now floored or denied.

**Why.** Card E2.11 step 6: the E2.7 cases are the ones to flip.

**Result.** The file goes from E2.7's cases to 393 tests, all passing: the 49 cells times 3 operations under both options; the owner's rules (the owner's rule and the grant rule still decide first where they did); team scope under each registered preset with the options on and under `medium-trust`; GH-39's floor, promotion, retired content and simulator; plus a sweep, a commit-time race, a promotion and a check. E2.7's own cases are unchanged and still pass with the options off.

**Consequence.** Nothing; the file documents both behaviours side by side.
