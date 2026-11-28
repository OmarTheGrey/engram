---
date: 2026-11-28
author: claude-agent
type: failure
card: E8.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - fixtures/harness/codex/inputs/apply-patch-indented-add.json
  - fixtures/harness/codex/inputs/apply-patch-tab-delete.json
  - make test-one T=packages/mcp/test/codex-hook.test.ts
supersedes: none
---

**What.** The review found the apply_patch reading missed a header after leading whitespace: `  *** Add File: memory/x.md` and a tab before `*** Delete File: .codex/hooks.json` passed, and Codex applies both.

**Why.** Codex trims a line before it reads a header (`codex-rs/apply-patch/src/streaming_parser.rs`); the pattern anchored `***` at column 0.

**Result.** Both inputs are fixtures, and three cases are in the unit test; they failed first (5 failures), then passed once the pattern allowed spaces and tabs before `***`. 43 tests pass.

**Consequence.** The whole apply_patch route, protected files included, holds against indentation.
