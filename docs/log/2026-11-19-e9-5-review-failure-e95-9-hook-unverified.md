---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - docs/dogfood.md
  - fixtures/harness/claude-code/.claude/settings.json
  - test/e2e/mcp.e2e.test.ts
supersedes: none
---

**What.** Review finding E95-9 (important): the procedure had no step checking the Claude Code hook works, and whether Claude Code honours `args` on a hook entry was unverified.

**Why.** The first pass copied the fixture's shape without checking it against Claude Code's documentation.

**Result.** Claude Code's hooks reference (https://code.claude.com/docs/en/hooks.md, "Exec form and shell form") documents `args`: with it, `command` is spawned directly, and on Windows must be a real executable, so `node` is right. The procedure cites it, recommends `"onFailure": "block"` on v2.1.295 or later, and adds a check: `/hooks`, one blocked Read, and `bypass_blocked` in an interim report.

**Consequence.** Precondition 4 of the start is each member's passed check.
