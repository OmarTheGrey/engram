---
date: 2026-11-22
author: claude-agent
type: change
card: E9.8
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/cli/src/import/claude.ts
  - packages/cli/test/claude-memory.test.ts
  - "make test-one T=packages/cli/test/claude-memory.test.ts"
supersedes: docs/log/2026-11-21-e9-8-change-claude-parser.md
---

**What.** The Claude memory parser reads only the lines inside code fences when the text holds one, replaces a bracketed date after the import time by the import time and reports it, and writes its dashes as escapes.

**Why.** Review finding E9.8-5 and the minor findings: a remark such as "Sure! Here is everything I remember about you." before the block was read as a memory; the lead decided a future date's treatment.

**Result.** 7 of 7 parser tests pass; reading the text around the block again fails the new test (mutation check). A pasted memory is recorded as kind `import`.

**Consequence.** None.
