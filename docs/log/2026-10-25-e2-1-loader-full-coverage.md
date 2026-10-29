---
date: 2026-10-25
author: claude-agent
type: change
card: E2.1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/policy/load-edges.test.ts
  - packages/core/src/policy/load.ts
supersedes: none
---

**What.** The policy loader now has 100 percent branch coverage from the policy tests, up from 92.53 percent (62 of 67 branches).

**Why.** The testing convention asks for 100 percent branches on policy/.

**Result.** Four new tests in load-edges.test.ts reach the four live branches through parsePolicy: an explicit key with no value, a null threshold key, and YAML 1.1 binary and timestamp scalars where a mapping belongs. One branch was dead and is removed: the non-Error fallback when toJS throws, since every throw in yaml 2.9.1 is an Error. Coverage is 65 of 65 branches, measured with vitest and a temporary @vitest/coverage-v8 5.0.5 that is not committed.

**Consequence.** None in behaviour. A tagged scalar's problem points at its value, after the tag.
