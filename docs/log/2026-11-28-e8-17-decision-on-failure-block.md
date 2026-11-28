---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.17
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/snippets.ts
supersedes: none
---

**What.** Every installed or shown Codex entry carries `onFailure: "block"`, as the Claude Code snippet already does.

**Why.** The hook fails closed by design (ADR 0022); Codex's HookFailurePolicy defaults to continue, which lets a call through when the hook cannot run.

**Result.** A Codex session whose `engram` is missing blocks every tool call until fixed.

**Consequence.** If that is too strict for a member, they remove the key; the TUI says what it does.
