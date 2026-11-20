---
date: 2026-11-20
author: claude-agent
type: finding
card: RV5
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - docs/dogfood.md
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Claude Code's native auto memory reads and writes the very folder the twin dogfood governs, and its transcripts keep MCP results in plain text (finding RV-SRF-5).

**Why.** The review found `docs/dogfood.md` silent on both.

**Result.** Claude Code's docs (https://code.claude.com/docs/en/memory and /claude-directory): auto memory is on by default, loads the first 200 lines or 25 KB of `MEMORY.md` into every session, and is turned off by `"autoMemoryEnabled": false` in any settings file, the `/memory` toggle, or `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. Transcripts under `~/.claude/projects/<project>/` are plaintext with tool results, deleted after `cleanupPeriodDays` (default 30); `CLAUDE_CODE_SKIP_PROMPT_HISTORY` stops them. `docs/dogfood.md` now has members turn auto memory off in `.claude/settings.local.json`, add a CLAUDE.md line, and states the transcript limit.

**Consequence.** Whether Gate D's "zero recorded violations" stands beside the ungoverned context and transcripts is the lead's decision (backlog row "Claude Code's native memory path").
