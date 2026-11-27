---
date: 2026-11-25
author: claude-agent
type: failure
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/line.test.ts
  - packages/cli/test/registry.test.ts
  - packages/cli/src/tui/actor.ts
  - packages/cli/src/tui/log-check.ts
supersedes: none
---

**What.** Two fix steps failed existing tests. F-3's first cut made actor.ts import forms.ts. Through fields.ts that pulled pi-tui into line mode, and line.test.ts's pi-tui import check failed. F-2's log check child filtered the prefix ENGRAM_TUI_HAND. registry.test.ts took that literal for an unnamed environment variable.

**Why.** The import graph was not checked before the import was added. The env test scans the source for ENGRAM_ literals.

**Result.** ACTOR_FLAGS moved to actor.ts, in a commit of its own, since the F-3 commit had landed. The filter names both variables in full. Both tests pass.

**Consequence.** Run line.test.ts after any import change under src/tui.
