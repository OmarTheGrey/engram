---
date: 2026-11-22
author: claude-agent
type: decision
card: L6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/routes.ts
  - packages/cli/test/supersede.test.ts
supersedes: docs/log/2026-11-21-l6-decision-all-or-nothing.md
---

**What.** Validation is all or nothing: an accepted id with no proposed close refuses the call before any write. The writes are not: each is the gate's own decision, and a store refusal stops the route, which returns `stopped` (its deny event) with what landed before it.

**Why.** L6-3: a close of an imported, read-only memory file escaped as an internal error. The adapter contract does not say whether an item can be rewritten, so the plan cannot flag one in advance.

**Result.** The CLI test on an imported Claude Code memory file: exit 1, `stopped` carries engram/write/store-failure, and the file is unchanged. Under the clash rule a plan proposes at most one close, since two candidates that both overlap the new item overlap each other, so no partial application arises today.

**Consequence.** A rewritability capability in the adapter contract would let the plan flag such items.
