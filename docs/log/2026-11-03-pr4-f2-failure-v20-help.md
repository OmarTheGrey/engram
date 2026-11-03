---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/scripts/h1-sessions.ts
supersedes: none
---

**What.** `node packages/runner/scripts/h1-sessions.ts --help` printed "Unknown option '--help'" (V-20).

**Why.** parseArgs is strict and the script declared no help option.

**Result.** It now prints the usage and exits 0 (`2026-11-03-pr4-f2-converter-help`).

**Consequence.** Every script reached from the Makefile answers `--help`.
