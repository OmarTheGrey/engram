---
date: 2026-11-28
author: claude-agent
type: change
card: E8.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
  - packages/core/test/unit/no-bypass.test.ts
  - packages/pi-extension/test/attacks.test.ts
  - packages/mcp/test/hook.test.ts
  - packages/mcp/test/codex-hook.test.ts
supersedes: docs/log/2026-11-28-e8-17-finding-powershell-backtick.md
---

**What.** Core's shell path check also reads a command with PowerShell's backtick and cmd's caret removed, as its store-name check already did, under every shell flavour; the orchestrator decided to fix it in core in this card.

**Why.** ``Get-Content mem`ory\a.md`` and ``Remove-Item .co`dex\hooks.json`` passed the path route for the pi extension and both hooks (finding powershell-backtick).

**Result.** Test first: 4 core cases, 2 Claude Code hook cases, 3 Codex hook cases and one pi extension session test failed without the change and pass with it (core no-bypass 173 and 72, mcp hook 73, codex hook 46, pi attacks 41). Carets were already caught; their removal is defensive. Rule 1 holds: the change is core's.

**Consequence.** Erring towards blocking: a POSIX command substitution with backticks is also read with them removed.
