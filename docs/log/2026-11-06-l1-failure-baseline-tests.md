---
date: 2026-11-06
author: shady
type: failure
card: L1
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - "make test"
  - packages/core/test/unit/schema.test.ts
  - packages/runner/test/retrieval.test.ts
supersedes: none
---

**What.** `make test` failed before any L1 change and still fails after it, in tests L1 does not touch.

**Why.** Two kinds of failure. Letta adapter and runner b3 tests time out (about 30 s on git-backed Letta operations, 300 s in b3) while another session runs tests on the same machine. And packages/core/test/unit/schema.test.ts and packages/runner/test/retrieval.test.ts cannot load: they build paths from a file URL, so the space in "Graduation Project" stays `%20` and the folder is not found.

**Result.** Baseline: 6 of 139 files failed, 8 of 2501 tests. After L1: 4 of 141 files failed, 2 of 2540 tests, the same two path errors plus timeouts in letta conformance and b3. Every L1 test passed.

**Consequence.** The path bug needs its own fix (decode the URL with `fileURLToPath`); it is reported, not silenced, and out of this card's scope.
