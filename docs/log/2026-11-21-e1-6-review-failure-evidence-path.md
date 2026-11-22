---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/log/2026-11-21-e1-6-change-cli-log.md
  - docs/log/2026-11-21-e1-6-decision-opt-in-handle.md
supersedes: none
---

**What.** make lint-docs failed after the fix pass: two earlier entries named packages/cli/src/chain.ts as evidence, which the move of keepLogChain to packages/server deleted.

**Why.** check-log requires every evidence path to exist, and entries are otherwise immutable.

**Result.** Only the evidence line of those two entries was changed, to packages/server/src/workspace.ts, where keepLogChain now lives; their text stands, and each is superseded by a review entry.

**Consequence.** A file named as evidence is not deleted without updating the entries that name it.
