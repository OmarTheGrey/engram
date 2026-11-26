---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15b
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/package.json
  - biome.json
  - docs/deps.md
  - AGENTS.md
supersedes: none
---

**What.** `@earendil-works/pi-tui` 1.3.0 is a dependency of packages/cli and `@xterm/headless` 5.5.0 a dev dependency, each with a `docs/deps.md` row; biome overrides keep pi-tui inside packages/cli/src/tui and every other pi package out of packages/cli; AGENTS.md's What not to do line (and CLAUDE.md) gains the pi-tui clause of ADR 0044 decision 3.

**Why.** Card E8.15b and ADR 0044 decisions 1 to 4.

**Result.** The lock gains only the packages/cli importer lines and `@xterm/headless` (pi-tui was already locked through pi-coding-agent). `engram doctor --db :memory:` prints `ok pi pin pi-ai 1.3.0, pi-coding-agent 1.3.0, pi-tui 1.3.0`. Probe imports: pi-tui from packages/core/src, packages/cli/src and packages/cli/test fail lint, from packages/cli/src/tui it passes; pi-ai from packages/cli/src/tui fails.

**Consequence.** A pi pin bump moves pi-tui in the same PR; doctor's pin check covers it.
