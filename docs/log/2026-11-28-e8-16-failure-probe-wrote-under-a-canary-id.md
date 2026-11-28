---
date: 2026-11-28
author: claude-agent
type: failure
card: E8.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/leakage.test.ts
  - packages/server/test/leakage-kit.ts
supersedes: none
---

**What.** The first write probes used canary ids; under the denied write's id, which the log never held, the probe's own item landed and every later read showed the probe its own item under a canary id, counted as a leak.

**Why.** A denied write leaves its id unheld, so the id is free.

**Result.** Write probes now use fresh seeded ids; checkWrite, which stores nothing, asks under every canary id.

**Consequence.** None.
