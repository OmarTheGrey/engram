---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15a
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/registry.test.ts
  - docs/log/2026-11-22-e8-15a-decision-writes.md
supersedes: none
---

**What.** My decision entry said the registry test pins every `writes` answer it settled; it pinned none of supersede `--accept`, export `--out`, hook or mcp over stdio, and three more claims had no test (the leak, credentials, Object's property names).

**Why.** I wrote the entry from the code, not from the test file.

**Result.** The review's mutants M2 (export never file) and M11 (hook none) survived, and M4 and M7 too; all four now fail tests.

**Consequence.** Entries claim only what a named test checks.
