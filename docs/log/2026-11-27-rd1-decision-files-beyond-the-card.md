---
date: 2026-11-27
author: claude-agent
type: decision
card: RD1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/RD1.md
  - packages/core/src/supersede.ts
  - packages/view/src/view.ts
  - packages/cli/src/tui/screens/grants.ts
supersedes: none
---

**What.** The review fix pass edits files the card's list does not name: `packages/core/src/supersede.ts` and `plane/commit.ts`, `packages/view/src/view.ts`, and the TUI's `grants.ts` and `rich.ts`.

**Why.** Findings 5 and 6, which the orchestrator asked to fix, live there. Main moved the inspector's view logic from `packages/ui/src/view.ts` to `@engram/view` (card E8.15c) after the card was written, and the TUI, out of scope while it was on `cliupgrade`, merged with it and shares `shownGrants`. Moving `writeClosures` into core needs `supersede.ts`; naming the mend clause once needs `commit.ts`.

**Result.** Each edit is the smallest the finding needs; the card's status line lists them.

**Consequence.** If wrong, findings 5 and 6 go back to a follow-up card and the TUI keeps its old label.
