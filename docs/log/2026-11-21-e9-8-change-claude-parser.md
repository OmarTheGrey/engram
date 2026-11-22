---
date: 2026-11-21
author: claude-agent
type: change
card: E9.8
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/cli/src/import/claude.ts
  - packages/cli/test/claude-memory.test.ts
  - fixtures/imports/claude-memory.txt
  - "make test-one T=packages/cli/test/claude-memory.test.ts"
supersedes: none
---

**What.** `engram import --claude <file>` reads a memory list Claude shows a person, pasted as text, each bullet, dated line or paragraph one semantic candidate.

**Why.** Card E9.8, step 4. Claude's help centre (support.claude.com, article 12123587, read 2026-11-21) fixes no format; its export prompt for other services asks for one code block of `[date] - content` lines.

**Result.** The parser takes headings as sections, drops fences and the text after the closing one, and reads an ISO date as valid_from. 5 of 5 tests pass on a synthetic fixture; keeping the text after the closing fence fails 2 (mutation check).

**Consequence.** A format Claude adopts later may need another rule; the tests name each shape it reads.
