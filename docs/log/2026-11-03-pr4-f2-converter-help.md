---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/scripts/h1-sessions.ts
  - research/tests/test_h1_pipeline.py
supersedes: none
---

**What.** `node packages/runner/scripts/h1-sessions.ts --help` (or `-h`) prints the usage on stdout and exits 0. The stderr summary also gives the utility sessions kept.

**Why.** V-20.

**Result.** Before the change the command printed "Unknown option '--help'" and exited 1; the CLI test now asserts the usage line.

**Consequence.** None.
