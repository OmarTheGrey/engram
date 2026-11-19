---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.5
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/cli/src/hook.ts
  - packages/cli/src/connect.ts
  - docs/dogfood.md
supersedes: none
---

**What.** The dogfood uses the per-user default log, `~/.engram/engram.db`, emptied by renaming any earlier one, and the report reads SQLite only.

**Why.** A command given `--server` refuses `--db`, so the Claude Code hook running with `--server` protects only the default log from file tools; a dedicated log path would be unprotected. Everyone also runs SQLite by default.

**Result.** The procedure names no `--db`; `engram serve`, the hook and the report agree on one file. The report refuses a URL with exit 2 and prints no part of it (tested).

**Consequence.** A Postgres log needs the report to open it through core's Postgres opener; nothing in the dogfood needs it.
