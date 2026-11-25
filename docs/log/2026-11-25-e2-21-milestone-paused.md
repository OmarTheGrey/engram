---
date: 2026-11-25
author: claude-agent
type: milestone
card: E2.21
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/E2.21.md
  - packages/mcp/test/mcp.test.ts
  - packages/pi-extension/test/surface.test.ts
supersedes: none
---

**What.** E2.21 paused at the lead's request, during the review fix pass of part 1.

**Why.** The lead asked for a clean slate to resume from.

**Result.** Done: part 1's tests, the card, origin/main merged (#112, #113). In progress: E221-1 (MCP test over `toolList(true)`, recursive `replay` search) and E221-2 (`packages/pi-extension/test/surface.test.ts`); both pass, and mutations (`replay` on `memory_supersede`, top level and nested; a fifth pi tool; nested `replay` on `memory_simulate`) each fail them. Remaining: E221-3, the card names `grants.expiry_cap`, on in twin and knowledge, cites the lead's opt-in entry, settles `twin-reads.json` write 4 (lands unexpired, clock advances before the read) and lists the read filter tests writing other-class grants; E221-4, rewrite the decision entry; E221-5, assert `additionalProperties: false`, cite lines 136 to 153, widen the entry's scope; then lint, touched tests, PR.md.

**Consequence.** Resume with `git log --oneline -3` in the worktree.
