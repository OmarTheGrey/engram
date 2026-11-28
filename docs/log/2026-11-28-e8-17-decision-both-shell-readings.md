---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.17
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/hook.ts
  - fixtures/harness/codex/inputs/bash-powershell-path.json
supersedes: none
---

**What.** Codex's `Bash` command is checked under core's POSIX and PowerShell readings, a hit under either a block.

**Why.** Codex names its shell tool `Bash` whatever shell runs it (`codex-rs/core/src/tools/hook_names.rs`), and on Windows that shell is PowerShell or cmd, where a backslash is a separator.

**Result.** No spelling was found where core's two readings differ today, so no test can kill the second reading; it costs one more scan per call.

**Consequence.** If wrong, a POSIX command could be blocked for a PowerShell reading of it, erring towards blocking.
