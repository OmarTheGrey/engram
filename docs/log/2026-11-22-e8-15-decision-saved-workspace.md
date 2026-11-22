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
supersedes: none
---

**What.** The TUI saves the workspace flags in `~/.engram/tui.json` and, when they still work, opens on Home without first run; first run uses cheap checks, and doctor runs only on request.

**Why.** Review finding E8.15-9: nothing persisted, so a person retyped every flag at each start, and first-run detection ran the full doctor (3.5 s with the Letta probe). The file holds flags and TUI options only, never content, ids, tokens, keys or a Postgres URL's userinfo; "Forget saved workspace" deletes it and `--no-saved` ignores it.

**Result.** Sections 8.2 and 8.3 of the design and a test that nothing else is ever written.

**Consequence.** E8.15b adds `saved.ts`.
