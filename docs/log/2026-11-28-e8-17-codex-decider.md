---
date: 2026-11-28
author: claude-agent
type: change
card: E8.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/hook.ts
  - packages/mcp/test/codex-hook.test.ts
  - fixtures/harness/codex/schema/pre-tool-use.command.input.schema.json
  - make test-one T=packages/mcp/test/codex-hook.test.ts
supersedes: none
---

**What.** `codexHook` and `codexHookBypass` in packages/mcp answer Codex's PreToolUse input with the decider the Claude Code hook now shares (`harnessHook`), and Codex's two generated hook schemas are copied as fixtures with eight recorded inputs.

**Why.** Codex is a supported harness and no store command on its path was blocked; Codex ships PreToolUse hooks whose deny is Claude Code's shape (openai/codex `ebd0765aafa2`).

**Result.** 38 tests pass: every recorded input is valid against the copied input schema, every deny against the output schema; Bash, apply_patch file headers and other MCP tools' paths are checked. Mutation: dropping `Update File` and `Move to` from the header pattern fails 6 tests.

**Consequence.** The CLI and the e2e case build on it; the Claude Code hook's 64 tests pass unchanged.
