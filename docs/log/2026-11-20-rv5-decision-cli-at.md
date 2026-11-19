---
date: 2026-11-20
author: claude-agent
type: decision
card: RV5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/commands.ts
  - packages/cli/src/run.ts
supersedes: none
---

**What.** The CLI's `--at`: over `--server`, `engram write`, `promote`, `retain` and `lint` refuse it (exit 2); in process it sets the in-process server's clock for that one call; `engram read --at` is the read's `valid_at` in process and over `--server` alike.

**Why.** The card asks for the server's rule over `--server`. In process the CLI is the server (ADR 0027 decision 3), and the fault workspaces and tests name times with `--at` (`make fault-workspace` prints an `engram lint --at` command).

**Result.** `make test` passes with the CLI's tests unchanged but the help snapshot. `engram read` prints the read's ts and, when given, the validity time.

**Consequence.** An in-process read no longer time-travels grants or ttls. Cost if wrong: a member who wanted that loses it.
