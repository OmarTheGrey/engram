---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/cedar.test.ts
supersedes: none
---

**What.** Adding the line-break policy ids of review finding E2.12-4 through a Python script in a Bash heredoc wrote real line breaks into the test's string literals, and vitest refused to parse the file.

**Why.** The escapes `\n` and ` ` were turned into characters before the script wrote them, as the brief's pitfalls warn for heredocs.

**Result.** `PARSE_ERROR Expected ']'` at the new test; a second attempt through `python -c` failed the same way. The Edit tool wrote the escapes correctly, and the test then failed for the right reason (35 policies parsed where 33 were exported).

**Consequence.** Strings with escapes are written only with the Edit or Write tool.
