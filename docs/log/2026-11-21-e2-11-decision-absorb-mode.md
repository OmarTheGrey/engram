---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.11
chapter: related-work
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/trust.ts
  - docs/absorbed.md
supersedes: none
---

**What.** dent8 and Veracium are absorbed as ideas, not ports, so `docs/absorbed.md` gains no row.

**Why.** ADR 0037: a port is code written with the source open and following its structure. This card was written from ADR 0040 and `docs/research/absorb/19-github-scout.md`, with neither source open.

**Result.** Both, and mentisdb and Mnemowall, are cited in the header of `policy/trust.ts`.

**Consequence.** If the lead wants ports, the sources are read at a commit and the register gains rows.
