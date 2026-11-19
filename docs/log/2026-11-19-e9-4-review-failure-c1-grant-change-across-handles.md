---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/grants.ts
  - packages/core/test/unit/plane/grants.test.ts
supersedes: none
---

**What.** Review finding C1 of PR #44 (critical): a grant change could undo an erasure committed through another handle on the same log.

**Why.** `decideAndCommit` read the item, awaited the store write, then appended the allow event without reading the item again under the log's lock; the write queue orders calls within one db handle only. The reviewer reproduced it with two handles on one SQLite file: an offboarding on the second erased item 1 while the first's store write was held, and the allow event brought the content back, through a rebuild, with the store record recreated and the grantee reading it.

**Result.** Two tests reproduce it on `sqliteBackend.pair()` (an erasure, and a second grant change, on the other handle); both returned allow before the fix and pass after it. Mutants removing the re-check or the store repair each fail both.

**Consequence.** Fixed by decision `2026-11-19-e9-4-review-decision-commit-under-lock.md`.
