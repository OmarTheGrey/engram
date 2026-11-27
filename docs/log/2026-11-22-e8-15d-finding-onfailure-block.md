---
date: 2026-11-22
author: claude-agent
type: finding
card: E8.15d
chapter: related-work
pillar: plane
hypothesis: none
evidence:
  - https://code.claude.com/docs/en/hooks
  - fixtures/harness/claude-code/.claude/settings.json
supersedes: none
---

**What.** Claude Code's hooks reference documents `"onFailure": "block"` on command hooks: "Whether the action that triggered the hook goes ahead when the hook fails: continue or block … Requires Claude Code v2.1.295 or later."

**Why.** The review had it second-hand; the coordinator asked for it checked against Claude Code's own documentation before any use.

**Result.** Read on code.claude.com/docs/en/hooks, 2026-11-23. Failures that count include a hook that cannot start and an exit code other than 0 or 2, "even if it printed JSON that allows the action". The page's own example of the exec form (`command` and `args`, no shell) writes `${CLAUDE_PROJECT_DIR}` inside `args`, so expansion there is now documented too; absolute roots stay correct either way.

**Consequence.** The snippet sets it (see the decision entry of the same day), so a hook that cannot start blocks the call on v2.1.295 and later.
