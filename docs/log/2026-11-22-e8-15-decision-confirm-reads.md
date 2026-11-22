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
supersedes: docs/log/2026-11-21-e8-15-decision-confirm-undo.md
---

**What.** A read with a store folder is a state change: the first such read in a session asks, naming the owner's retention sweep and the folder's adoption, and later reads repeat that line in the command row; undo stays only for grant changes.

**Why.** The earlier entry said reads and lints only append audit events. That is false: `POST /read` runs `syncStore` first, which as the store's owner sweeps retention (it can retire expired items for good) and adopts the folder (review finding E8.15-1). E8.14's `/read/{itemId}` does the same.

**Result.** Sections 4, 8.5 and 9.5: classes none, audit, state, erase, file and process; a flows test checks the dialog comes before any call.

**Consequence.** The dialog cannot give a count until the plane offers a sweep preview (finding entry of this date).
