---
date: 2026-10-29
author: claude-agent
type: failure
card: E1.1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/replay/items-at.test.ts
  - packages/core/test/db/backends.ts
supersedes: none
---

**What.** The itemByStoreRef replay property failed on Postgres on its own generator check, not on the backend.

**Why.** The property asserts that more than 20 runs share a ref and more than 20 let lineage overrule seq, a floor written for 200 runs. Postgres runs a fifth of them (40), so the same seeded sequence gave 18.

**Result.** The floor became one run in ten of the backend's run count: 20 on SQLite, unchanged, and 4 on Postgres; every run's assertion is unchanged. The test passes on both backends.

**Consequence.** A property that also checks its generator states the check per run, so a backend with fewer runs does not fail it for the wrong reason.
