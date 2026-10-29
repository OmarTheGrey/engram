---
date: 2026-10-29
author: claude-agent
type: change
card: E8.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
  - packages/cli/test/hook.test.ts
  - packages/core/test/unit/no-bypass.test.ts
supersedes: none
---

**What.** Follow-up to the PR 3 fix-pass verification (findings R3-13 to R3-15): folders holding a protected file, the user-level Claude Code settings, and quoted arguments in the shell path check.

**Why.** `rm -rf ~/.engram`, `rm -rf .claude` and `mv .claude x` got past the hook; a user-level `disableAllHooks` could switch it off; `git commit -m "fix memory leak"` was refused.

**Result.** A word or path naming a folder that holds a protected file, strictly inside the project or home folder, is denied; `~/.claude/settings.json`, `~/.claude/settings.local.json` and `~/.claude.json` are protected; a quoted argument is one word, and only its path-like inner words are checked. Mutants: the ancestor rule (1 core, 1 cli test), the stop-folder exclusion (1), the user settings (1), the quoted-word rule (2).

**Consequence.** ADR 0014 lists the false positives kept on purpose; ADR 0022's residual limits shrink.
