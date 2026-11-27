---
date: 2026-11-26
author: claude-agent
type: failure
card: E8.15
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/snippets.test.ts
supersedes: none
---

**What.** The README review commit (`a73cc766`) left `snippets.test.ts` unparsable. A scripted edit wrote the new test's expected TOML with real line breaks inside a quoted string, where `\n` escapes belonged.

**Why.** The run after that edit printed "2 failed" test files beside the four MCP frames that were meant to change. Only the frames were read, and the frames were updated. `make lint` then caught the parse error.

**Result.** The expected text is now built by joining its lines. `snippets.test.ts` and `flows.test.ts` passed (52 of 52), and `make lint` passed. Two mutants were killed: the Codex actor not swapped, and the singular line reverted.

**Consequence.** After a scripted edit, every failed test file is read, not only the expected ones.
