---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/registry.test.ts
  - "ENGRAM_OFFLINE=1 pnpm exec vitest run packages/cli/test"
supersedes: none
---

**What.** The first run of every CLI test file with `ENGRAM_OFFLINE=1` failed one test of 654: registry.test.ts's scan of the variables the CLI reads found PATH, which no registry entry named.

**Why.** snippets.ts reads PATH and PATHEXT to resolve `engram`, and the TUI's tests had passed alone; the scan lives in the registry's test file, which the TUI's test runs did not include.

**Result.** The tui entry names PATH and PATHEXT, and PATH is found whatever its case through one read; registry.test.ts passes.

**Consequence.** Every CLI test file is run together before the report.
