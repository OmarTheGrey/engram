---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.11
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/crypto/keys.ts
supersedes: none
---

**What.** `make lint` failed: tsc's `erasableSyntaxOnly` refuses constructor parameter properties in `DataKeyShreddedError`.

**Why.** The class was written with `readonly` constructor parameters, which the repository's TypeScript settings forbid.

**Result.** "error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled"; fixed by declaring the fields and assigning them; `make lint` then passed.

**Consequence.** None.
