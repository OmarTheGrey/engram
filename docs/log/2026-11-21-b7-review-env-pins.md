---
date: 2026-11-21
author: claude-agent
type: change
card: B7
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/bench/src/merit/env.ts
  - packages/bench/test/merit/env.test.ts
  - "make test-one T=packages/bench/test/merit/env.test.ts"
supersedes: none
---

**What.** Review finding B7-8: MERIT's environment is installed with a constraints file pinning colorama 0.4.6 on Windows, and is checked with `uv pip freeze` against the lock's packages and the pins each time it is used, not only by the lock's hash.

**Why.** colorama came in unpinned, and a package changed by hand inside the environment passed the marker check.

**Result.** Reinstalled from the marker's removal in 8.9 s; the post-install check passes. Tests (3 pass): name normalisation, a version drift named as missing and extra, and the real environment matching exactly. Removing the colorama pin fails 2 of them.

**Consequence.** None.
