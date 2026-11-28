---
date: 2026-11-28
author: claude-agent
type: change
card: E8.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/hook-install.ts
  - packages/cli/test/hook-install.test.ts
  - make test-one T=packages/cli/test/hook-install.test.ts
supersedes: none
---

**What.** `engram hook install claude-code|codex` merges the hook's PreToolUse entry into `.claude/settings.json` or `.codex/hooks.json` (with `--user`, the user's), idempotently; obsidian-second-brain's installer is the idea (MIT, idea only).

**Why.** Setting the hook up by hand was the only way, and a second paste duplicated it.

**Result.** 13 tests pass, 1 skipped on Windows (sh quoting): a second run writes nothing (a file tree compared byte for byte), an earlier entry is replaced in place, other keys and hooks are kept, one backup is written, a link or bad JSON is refused untouched. Mutations: always writing fails 3 tests; never recognising its own entry fails 4.

**Consequence.** The TUI's hook screen runs it from an Install button.
