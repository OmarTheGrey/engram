---
date: 2026-11-21
author: claude-agent
type: change
card: E2.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
  - packages/core/test/unit/policy/secrets.test.ts
  - packages/core/test/unit/policy/secrets-upstream.test.ts
  - packages/core/src/plane/bypass.ts
  - "make test-one T=packages/core/test/unit/policy/secrets.test.ts"
supersedes: none
---

**What.** E2.9's last fix pass, after the verification (V-1 to V-9), rebased onto main with E2.10, B11 and D1.

**Why.** Three E2.9-8 fixes were untested, other E2.9-1 fixes unprotected, and the pass had opened three evasions.

**Result.** Tests pin the label window, the trailer exemption and both AWS example skips; each revert fails 1 to 4. Further tests: a 5 s all-keywords bound, `SCAN_LIMIT <= 65536`, 99,999 chained findings under 1 s, 1M-character lines under 5 s. Padding past the limit is denied under block; the trailer exemption takes only its own address; a four-word REVIEW label is restored; a widening grant is judged; a retired hold says so. D1's redactor reads the shared table, bypass output byte-identical on 10,620 lines; E2.10's screen runs after the guard. 389 tests in the two files, 100 percent of branches.

**Consequence.** The orchestrator's full gates, then the merge.
