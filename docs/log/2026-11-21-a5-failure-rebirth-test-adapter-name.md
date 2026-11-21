---
date: 2026-11-21
author: claude-agent
type: failure
card: A5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/plane/revocation.test.ts
  - "pnpm exec vitest run packages/adapters/test/plane/revocation.test.ts"
supersedes: none
---

**What.** The first run of the revocation grid failed 2 of 66 tests, both "rebirth by re-edit" rows on "fake without search or history".

**Why.** The test matched each adoption reason against the registry entry's name, but an adoption reason names the adapter (`adopted from store fake: `), and that registry entry's adapter is named `fake`.

**Result.** The assertion now uses `setup.adapter.name`; 66 of 66 passed on the next run, before the validity double was registered.

**Consequence.** Nothing beyond the fix: registry names are labels, adapter names are what the log records.
