---
date: 2026-11-25
author: claude-agent
type: finding
card: ANS-2026-11-25
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - packages/core/test/unit/plane/write-grants.test.ts
  - docs/tasks/backlog.md
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
supersedes: none
---

**What.** ADR 0034's one-year expiry cap and its first-write rule (item 34) are accepted but not implemented in `packages/core`.

**Why.** The lead's acceptance asks that the code be checked against the ADR.

**Result.** `grantDefect` in `packages/core/src/policy/evaluate.ts` checks the gate's grant rule, the class, expiry at or before `at`, and duplicates; it has no upper bound on `expires`. `evaluateWrite`'s loop judges a first write's grants by `grantProblem` and the duplicate check only (`if (!changesGrants || kept) continue;`), so a first write lands with an expired grant or one of another class. The test "a rewrite adding an expired grant is refused; a first write carrying one still lands" in `packages/core/test/unit/plane/write-grants.test.ts` pins today's behaviour.

**Consequence.** A core card builds both rules, changes that test, and fixes the fixtures. It must first show that no MANIFEST byte or cassette moves. The backlog row names it. This PR changes no code.
