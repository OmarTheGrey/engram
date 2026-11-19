---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/grants.ts
  - packages/core/test/property/grants.test.ts
supersedes: none
---

**What.** Review finding M6 of PR #44: a member of a scope whose level may not read it learned the item's owner from a grant change's refusal.

**Why.** The opaque refusal was decided by membership, not by `readableScope`.

**Result.** Fixed (decision `2026-11-19-e9-4-review-decision-refusal-by-read-access.md`); the property asserts that such a refusal names neither scope nor owner, and a mutant restoring the membership test fails it.

**Consequence.** None.
