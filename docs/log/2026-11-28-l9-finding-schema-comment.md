---
date: 2026-11-28
author: claude-agent
type: finding
card: L9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/schema.ts
supersedes: none
---

**What.** `schema.ts` still says of card E2.14's options that "Nothing builds any of them yet", and that the loader refuses every present value.

**Why.** Card L9 built `lints.model.evidence`, and only card E2.8 changes `schema.ts` (the brief's rule 5 guard), so this card left the comment.

**Result.** The comment is stale for one option of seven. `ModelLintOptions.evidence`'s own comment ("each flag carries the quoted span behind it, and a flag whose quote is not found is not a finding") matches what was built.

**Consequence.** The next schema card, or the last of D5, D4, E9.12, E9.13, E2.19 and E2.21 to land, should correct the block comment.
