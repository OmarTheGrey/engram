---
date: 2026-11-23
author: claude-agent
type: failure
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/app.ts
  - docs/design/tui-manual-check.md
supersedes: none
---

**What.** Commit 62a3e772 says Windows Terminal's colour answer was lost because the pseudoconsole's device attributes came first. That was wrong: the windows this session launched inherited NO_COLOR=1 from it, so no terminal could show colour.

**Why.** Found when the TUI's own output, logged in Windows Terminal, had no colour and no bold at all.

**Result.** With NO_COLOR cleared, pi-tui's own query answered in 8 ms in Windows Terminal (background 12,12,12) and the dark hues showed. The own-OSC 11 change stays for the reasons of its decision entry.

**Consequence.** Every manual check run clears NO_COLOR; the manual check document says so.
