---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.15
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/design/tui.md
  - packages/server/src/routes.ts
supersedes: none
---

**What.** Four new plain commands, `engram check`, `engram events`, `engram policy` and `engram grants`, each one call of the generated client, are proposed so the TUI can reach the routes the inspector uses.

**Why.** `/items/check`, `/events`, `/policy` and `/grants` have no command today. A TUI screen without a command would break the principle that every action shows the command it amounts to, and leaving the screens out would drop the timeline, the grants editor, the policy view and the write preview.

**Result.** Section 3.6 specifies the four; they are new, so no pinned output changes.

**Consequence.** For the lead (section 14, item 2). If declined, E8.15a drops them and section 3.8 lists the four screens as not reachable.
