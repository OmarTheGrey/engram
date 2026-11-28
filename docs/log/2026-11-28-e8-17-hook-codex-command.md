---
date: 2026-11-28
author: claude-agent
type: change
card: E8.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/hook.ts
  - packages/cli/test/hook-codex.test.ts
  - make test-one T=packages/cli/test/hook-codex.test.ts
supersedes: none
---

**What.** `engram hook codex` runs the Codex decider as Codex launches it: stdin JSON, a deny on stdout, exit 0, block events as `agent:codex` unless `--as`.

**Why.** The card's goal: Codex's hook decides with core's shell and path checks.

**Result.** 5 tests pass on a copy of fixtures/harness/codex and a temporary home and CODEX_HOME: each recorded input gets its expected answer, Codex's config and hooks files (project and CODEX_HOME) and the log are guarded, `--root` resolves against the hook's cwd. The Claude Code hook's 15 CLI tests pass unchanged.

**Consequence.** Registered in the CLI registry with its help section.
