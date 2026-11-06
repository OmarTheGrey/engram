---
date: 2026-11-06
author: shady
type: failure
card: PX3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-package/test/install.test.ts
supersedes: none
---

**What.** With all three acceptance tests passing, the suite still failed: removing the temporary project in `afterAll` raised `EPERM` on Windows.

**Why.** `kill()` returns before the pi process exits, and Windows keeps the folder locked while pi holds files in it.

**Result.** `afterAll` now waits for the process's `exit` event before removing the folder; the suite passes (`pnpm exec vitest run packages/pi-package/test/install.test.ts`).

**Consequence.** Any test here that spawns pi in a temporary folder waits for exit before cleanup.
