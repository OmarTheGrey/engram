---
date: 2026-11-25
author: claude-agent
type: decision
card: L8
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/det.ts
supersedes: none
---

**What.** Under the read filter, expired-validity still looks at every active item of the linted scope whose validity has begun. So it flags an item whose valid_to has passed or whose ttl has run out, though the filter refuses that item.

**Why.** Every item that lint exists to flag is one the filter refuses as ended. Filtering its subjects would leave it unable to fire. Its finding names only the item's own valid_to or ttl, never its content, and the item is in a scope the linter may read.

**Result.** A unit test covers it. Mutation: giving the lint the admitted subjects only fails that test. A not-yet-valid item is never its subject.

**Consequence.** If this is wrong, scope members learn that an item ended, which the log's retire events show them anyway after a sweep.
