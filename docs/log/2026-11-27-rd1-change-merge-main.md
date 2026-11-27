---
date: 2026-11-27
author: claude-agent
type: change
card: RD1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/architecture.md
  - docs/tasks/backlog.md
  - packages/ui/src/view.ts
supersedes: none
---

**What.** Merged `origin/main` (through R6, #120) into `rd1-read-disclosure` and resumed the paused card.

**Why.** Main had moved for two days: the lead's acceptance of ADR 0034, the TUI (E8.15), and cards R5, R6, X20 to X23.

**Result.** Three conflicts. `docs/architecture.md`: main's paragraph (ADR 0034 accepted, the cap not built) with RD1's disclosure sentence in place of the one it replaced. `docs/tasks/backlog.md`: main's item 34 row and RD1's item 36 row. `packages/ui/src/view.ts`: main's re-export of `@engram/view`; RD1 had changed only a comment there, now carried by the finding 5 change in `packages/view/src/view.ts`. `pnpm install --frozen-lockfile` was needed for the new package.

**Consequence.** The TUI is on main, so the review fix pass covers it.
