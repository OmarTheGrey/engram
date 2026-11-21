---
date: 2026-11-21
author: claude-agent
type: change
card: E1.5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - Makefile
  - AGENTS.md
  - CLAUDE.md
  - docs/deps.md
  - make verify-spec
supersedes: none
---

**What.** `make verify-spec`: typecheck, the scenario tests, simulation of the good model at seeds 1 to 3, the broken model's refutation by simulation, and with a JVM Apalache's bounded check of both to 4 steps. It stays outside `make test`.

**Why.** The card's acceptance: a passing run must mean the checker can see the bug it guards against.

**Result.** `make verify-spec` exited 0 in 5 min 26 s: 6 and 1 scenario tests passing; `[ok] No violation found` at seeds 1, 2 and 3; Apalache passed the good model to 4 steps (157970ms); the broken model was refuted by both. With CHECKED set back to true in the broken module, the target exited 2, and each gate reported it not refuted.

**Consequence.** AGENTS.md and CLAUDE.md list the command, the .PHONY line names it, and docs/deps.md has a row each for Quint and Apalache.
