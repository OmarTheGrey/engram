---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/design/tui.md
  - fixtures/harness/claude-code/.claude/settings.json
supersedes: docs/log/2026-11-22-e8-15-decision-keys-snippets.md
---

**What.** The palette is `;` (ctrl+p as a second binding), help `?` (ctrl+g in a field), supersede `S`, Home has six groups; the hook and MCP snippets keep the fixtures' `command` and `args` shape but write absolute store roots, and on Windows use a PATH `engram` only if it is an `.exe`, else `node.exe` and the absolute `main.ts`.

**Why.** The earlier entry said the snippets take the fixtures' shape unchanged. Claude Code's command form and Node's `spawn` without a shell start no `.cmd` shim, so the hook would fail open, and expansion of `${CLAUDE_PROJECT_DIR}` inside `args` is not documented (verification findings V1 and V3).

**Result.** Sections 8.14 and 8.15; Try it spawns the exact entry on a scratch log with no server.

**Consequence.** `snippets.test.ts` puts a `.cmd` on the PATH and expects the `node.exe` form.
