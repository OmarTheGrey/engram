---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.10
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/harness-settings.ts
  - packages/cli/src/discover.ts
supersedes: none
---

**What.** `CODEX_HOME` from the environment moves the Codex home; Claude Code's `autoMemoryDirectory` is read from the user settings file `~/.claude/settings.json`, that one key only, `~` expanded.

**Why.** Both are documented relocations. The settings file is configuration, not memory content, so reading one key from it is outside rule 12's concern, as the coordinator allowed; memory files are still never opened.

**Result.** Tests for each in `packages/cli/test/doctor-discover.test.ts`. The first line now says "no memory file opened".

**Consequence.** If wrong: the key set in project or managed settings is not read, so such a folder goes uncounted; stated in `harness-settings.ts`.
