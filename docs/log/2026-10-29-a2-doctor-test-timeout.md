---
date: 2026-10-29
author: claude-agent
type: failure
card: A2
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/review-verification.test.ts
  - packages/cli/src/doctor.ts
  - "make test"
supersedes: none
---

**What.** The first `make test` after the letta doctor check landed failed one test, "doctor and write print no part of the secret", at the 30 s timeout; a rerun passed (91 files, 1903 tests).

**Why.** That test runs `engram doctor` once per URL case; the letta check adds about 650 ms per run on this machine (thirteen git processes), and alone the test went from 18.4 s to 21 s, which leaves little room under the load of the full parallel suite.

**Result.** Overlapping the letta check with the earlier checks saved nothing measurable (21.1 s) and was reverted. The test file is outside card A2's files, so its timeout was not raised.

**Consequence.** The test is load-sensitive on Windows; if it times out again, the fix is a per-test timeout or fewer doctor runs in it, in its own change.
