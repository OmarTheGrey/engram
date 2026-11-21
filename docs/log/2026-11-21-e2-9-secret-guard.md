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
  - packages/core/src/policy/evaluate.ts
  - packages/core/test/unit/policy/secrets.test.ts
  - "make test-one T=packages/core/test/unit/policy/secrets.test.ts"
supersedes: none
---

**What.** `packages/core/src/policy/secrets.ts` is a pure detector over a write's content, with one call site in `evaluateWrite` after every access check and before review: `secrets` and `pii` each off, review (held as a candidate) or block (denied, check `content-guard`), and `max_content_bytes` (denied, `engram/write/content-size`).

**Why.** ADR 0039: the gate checked who and where, never what; an API key pasted into a conversation was stored and recalled.

**Result.** Rule ids `engram/write/secret`, `/pii`, `/content-size`, `/guard-failure`. A reason names kind and length only. The acceptance file passes, 389 tests, with 100 percent statements and branches on `secrets.ts` and `backtracking.ts`. Mutations: a Luhn check that always passes failed 2 tests; a reason carrying 4 characters of the value failed 9.

**Consequence.** Off in every registered preset, since no preset has the block. Card X14 measures it against attacks.
