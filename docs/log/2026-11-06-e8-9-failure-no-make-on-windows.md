---
date: 2026-11-06
author: claude-agent
type: failure
card: E8.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - Makefile
supersedes: none
---

**What.** The build machine for this card (Windows 11, Git Bash) has neither `make` nor the GitHub CLI, so `make test`, `make lint`, `make api` and `make lint-docs` were run as the recipes the Makefile spells, and the PR was prepared locally rather than opened.

**Why.** AGENTS.md wraps every command in the Makefile; a member without `make` must read it to run them.

**Result.** Each recipe passed when run by hand; the commands are listed in the PR body.

**Consequence.** None for the code; CI runs the real targets.
