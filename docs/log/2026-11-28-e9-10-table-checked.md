---
date: 2026-11-28
author: claude-agent
type: finding
card: E9.10
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/discover.ts
  - packages/core/test/unit/discover.test.ts
supersedes: docs/log/2026-11-28-e9-10-table-unfetched.md
---

**What.** The independent review fetched each linked vendor page on 2026-11-28 and quoted it; the table now follows those quotes, and `LOCATIONS_AS_OF` 2026-11-28 is a checked date.

**Why.** The first table was written from documentation as known, unfetched.

**Result.** Cursor project rules are `.mdc` only ("A plain `.md` file in `.cursor/rules` is ignored"). Codex memories are `$CODEX_HOME/memories_v2/` on a fresh home and `memories/` on an existing one, now documented, linked to learn.chatgpt.com. The Codex and Cursor links moved to their current pages. Claude Code's managed policy CLAUDE.md is a row, at its three platform paths. `.cursorrules` is unverified, with its reason in `note`. `AGENTS.md` names Codex, Claude Code and Cursor as readers, in the row, the JSON groups and the text report. `packages/core/test/unit/discover.test.ts`: 17 passed.

**Consequence.** Eleven rows documented, one unverified.
