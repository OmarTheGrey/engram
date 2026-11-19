---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/ui/src/view.ts
  - packages/ui/test/twin.test.ts
supersedes: none
---

**What.** Review finding M2 of PR #44: the inspector showed a grantee every grant on an item it reads, so it learned who else may read it.

**Why.** The lanes listed `item.grants` as the read returned them.

**Result.** Fixed in the inspector only, as the review asked (decision `2026-11-19-e9-4-review-decision-grants-shown.md`); the read path is unchanged (finding of the same day).

**Consequence.** A backlog row for the read path.
