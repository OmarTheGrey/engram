---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - README.md
  - AGENTS.md
supersedes: none
---

**What.** The root README groups a selection of commands in one table and links to AGENTS.md's "Commands" for the full list, and its status is one dated section that names known limits beside what works.

**Why.** AGENTS.md's command list is long, binding and kept byte-identical in CLAUDE.md; a copy in the README would drift from it. A status without its limits (self-asserted identity, a log that is not yet tamper-evident, the confirmed trust gap, the weaker guarantee outside pi) would claim more than the code bears out.

**Result.** Fourteen command rows, each checked against the Makefile, `make help` and `engram --help`, and five stated limits, each citing its ADR or card.

**Consequence.** If wrong, the cost is a README a newcomer must leave for AGENTS.md to find a rarer command.
