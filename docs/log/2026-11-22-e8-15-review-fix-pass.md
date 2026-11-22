---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/design/tui.md
  - docs/decisions/0044-cli-tui.md
  - docs/tasks/E8.15.md
supersedes: docs/log/2026-11-21-e8-15-design.md
---

**What.** The review fix pass of card E8.15's design: ten important and ten minor findings and ten usability changes, applied to `docs/design/tui.md`, ADR 0044 and the card.

**Why.** The review found reads classed as audit-only although they sweep and adopt, a hook Try it that wrote to the real log, snippets that fail open, remedies derived from rule ids (rule 1), and drift from cards E8.12, E8.14, D2 and E1.6.

**Result.** Reads with a store folder now ask once a session; Try it runs the copied command on a scratch log; Serve, MCP and Keys follow E8.12; the key map works in VS Code; a saved workspace skips first run; line mode, colour contrast, conhost glyphs, exit codes and the inventory are corrected. The mockup script regenerated every frame; `make lint-docs` passes.

**Consequence.** The implementation proceeds on the six calls decided under delegation (item 62).
