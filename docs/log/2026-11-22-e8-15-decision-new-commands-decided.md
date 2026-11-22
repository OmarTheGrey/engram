---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/design/tui.md
  - packages/server/src/routes.ts
supersedes: docs/log/2026-11-21-e8-15-decision-new-commands.md
---

**What.** `engram check`, `engram events`, `engram policy` and `engram grants` are added in E8.15a, and `engram scopes` and `engram read --item <id>` in E8.15a once card E8.14 merges.

**Why.** Decided on 2026-11-22 under the lead's delegation (item 62, call 3). Every TUI screen needs a plain command to teach; without these the timeline, the grants editor, the policy view, the write preview and opening an item by id would be lost.

**Result.** Sections 3.6, 3.8 and 12.2. E8.14's two routes each append a read event and `/read/{itemId}` sweeps and adopts, so `engram scopes` is called once per actor per session and cached for every picker, and `read --item` is treated as a read with its confirmation.

**Consequence.** Supersedes the entry that left the commands to the lead.
