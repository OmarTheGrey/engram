---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15e
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/app.ts
  - packages/cli/src/tui/theme.ts
  - packages/cli/test/tui/access.test.ts
supersedes: none
---

**What.** The TUI asks the background with one OSC 11 question and reads the answer before pi-tui, whenever it comes, rather than through pi-tui's queryTerminalColors.

**Why.** pi-tui's query sends 18 colour questions ended by a device-attributes request and resolves on that reply; an answer after it would reach the screens as input. Reading OSC 11 alone, and consuming any answer, needs no ordering and can never type an answer into a field.

**Result.** Windows Terminal answers rgb:0c0c/0c0c/0c0c and the dark hues show; conhost does not answer and the symbols stay bold with no hue (manual check). Tests: answer after the device attributes, late answer not typed.

**Consequence.** Superseding a first reason, see the colour failure entry.
