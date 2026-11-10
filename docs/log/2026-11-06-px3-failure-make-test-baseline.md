---
date: 2026-11-06
author: claude-agent
type: failure
card: PX3
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - "make test"
  - packages/core/test/unit/schema.test.ts
  - packages/runner/test/retrieval.test.ts
  - packages/runner/test/b3.test.ts
supersedes: none
---

**What.** `make test` failed on this machine before PX3 changed anything (39 tests in 17 files) and after (13 tests in 11 files), none in `packages/pi-package`.

**Why.** Three causes outside the card: two tests read fixture folders from an unescaped file URL, so the space in `D:\Graduation Project` becomes `%20` (`schema.test.ts`, `retrieval.test.ts`); `b3.test.ts` sees temporary Letta folders of other sessions running tests at the same time; and Letta lock and `EBUSY` contention plus 30 s timeouts under that load.

**Result.** Rerun alone, those files still fail in 4 places (the two `%20` suites, `b3.test.ts`, one Letta lock); the doctor tests pass. The PX3 tests pass in every run.

**Consequence.** `make test` needs a checkout path without spaces, or the URL fix in its own PR.
