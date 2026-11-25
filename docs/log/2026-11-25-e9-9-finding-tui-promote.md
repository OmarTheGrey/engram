---
date: 2026-11-25
author: claude-agent
type: finding
card: E9.9
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - docs/design/tui.md
  - packages/cli/src/run.ts
supersedes: none
---

**What.** The TUI on branch `cliupgrade` labels `--review` "Approve as reviewer" in its Promote form, and its handoff of an import says a reviewer promotes.

**Why.** Since card E9.9 the same flag also lets an owner accept a candidate in their own person scope.

**Result.** The plain CLI's help now names both; the read and explain shapes are unchanged, and a promote event may carry `engram/promote/owner-person`.

**Consequence.** The TUI should relabel the flag (for example "Approve, or accept as owner") and show the new policy id; nothing breaks if it does not.
