---
date: 2026-11-25
author: claude-agent
type: finding
card: ANS-2026-11-25
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0044-cli-tui.md
  - AGENTS.md
  - git show cliupgrade:biome.json
supersedes: none
---

**What.** ADR 0044's main rule, pi-tui reached only from `packages/cli/src/tui`, is enforced only on branch `cliupgrade`, not on main.

**Why.** The acceptance asks for the code and the test that enforce each ADR's rule.

**Result.** On main no package depends on `@earendil-works/pi-tui`, `packages/cli/src/tui` does not exist, and neither `biome.json` nor AGENTS.md names pi-tui, so the rule holds trivially. On `cliupgrade`, `biome.json` has `noRestrictedImports` overrides naming `@earendil-works/pi-tui` for `packages/cli` outside `src/tui` and for core, adapters, tag, kit and ai-sdk, and its AGENTS.md carries decision 3's clause. `make lint` is the check. This PR leaves AGENTS.md and CLAUDE.md alone so as not to conflict with that branch.

**Consequence.** The rule, its lint and the AGENTS.md clause reach main when `cliupgrade` merges. Nothing the TUI shows changes with this PR.
