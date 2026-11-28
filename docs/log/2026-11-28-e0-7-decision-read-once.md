---
date: 2026-11-28
author: claude-agent
type: decision
card: E0.7
chapter: design
pillar: research
hypothesis: none
evidence:
  - scripts/test/offline-guard.ts
  - docs/log/2026-11-22-l7-failure-tests-under-offline.md
supersedes: none
---

**What.** The guard reads `ENGRAM_OFFLINE` once, when the setup file runs in a worker, not at each call.

**Why.** Several tests (cards L7 and X14) clear the variable for their own call (`withOffline`) to drive a fake fetch past a code-side guard. Read per call, the guard would lift for those calls and a real network call inside one would pass; read once, only the named helper lifts it.

**Result.** Those tests still pass, since their fakes are injected and never reach the global `fetch`: every project passed under the guard.

**Consequence.** Lifting the guard needs `allowPinnedDataFetch`, which the guard's own test ties to a listed file.
