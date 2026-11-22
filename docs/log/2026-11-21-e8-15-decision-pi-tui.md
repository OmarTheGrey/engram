---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.15
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0044-cli-tui.md
supersedes: none
---

**What.** The TUI is built on `@earendil-works/pi-tui` at the pi pin (1.3.0), imported only under `packages/cli/src/tui/`; ADR 0044, proposed.

**Why.** Compared with Ink 8.0.0, @clack/prompts 1.9.0, OpenTUI 0.9.7, blessed, neo-blessed and a hand-rolled renderer on Windows support, maintenance, licence, size, headless testing, accessibility and Node 24. OpenTUI needs Node 26.4, blessed is unmaintained, clack draws no layout. pi-tui adds no package to the lockfile, is the pi family's (ADR 0001), and takes an injected `Terminal`.

**Result.** ADR 0044 records the comparison and the spike; ADR 0033's list needs one amendment for `packages/cli/src/tui`, and a biome rule keeps pi-tui out of every other CLI file.

**Consequence.** Item 62 for the lead; option (b) is Ink, which changes only the rendering layer of the design.
