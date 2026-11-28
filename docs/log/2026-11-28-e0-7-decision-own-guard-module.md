---
date: 2026-11-28
author: claude-agent
type: decision
card: E0.7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/adapters/test/conformance/network-guard.ts
  - scripts/test/offline-guard.ts
supersedes: none
---

**What.** The adapters' `network-guard.ts` is followed in shape (fetch, socket connect, DNS) but not imported or changed; the run's guard is a new module under `scripts/test/`.

**Why.** The conformance guard refuses the loopback too and its suite requires zero attempts, which is right for it; making it loopback-aware would change another package, which the card puts out of scope.

**Result.** The two compose: the conformance run installs its guard over the run's and restores it after. The adapters project passed under the run's guard.

**Consequence.** Two guard modules to keep in step; a later card may make the adapters' a thin wrapper.
