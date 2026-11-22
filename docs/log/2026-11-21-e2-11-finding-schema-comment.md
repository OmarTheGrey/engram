---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/schema.ts
supersedes: none
---

**What.** The comment on `Trust` in `schema.ts` still says nothing enforces the options.

**Why.** Only card E2.8 edits `schema.ts` (AGENTS.md rule 5), so this card left it.

**Result.** The comment is stale from this card on; the code and the loader enforce both options.

**Consequence.** The next schema card fixes the comment.
