---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/ai-sdk/test/ai-package.test.ts
  - scripts/test/tasks-and-decisions.test.ts
supersedes: none
---

**What.** Failures met in the fix pass: the first `ai` package test failed twice, an edit wrote raw Unicode into a test, and the ADR index test fails on this branch.

**Why.** The test's prompt was a sentence whose words the fake store did not match, so no recall was added; its expected rule was the source rule where the actor was not a member at all. A shell heredoc turned escapes into raw characters. The index test wants ADR numbers consecutive, and 0043 to 0046 belong to other branches.

**Result.** The prompt became plain query words and the expected rule `engram/write/membership`; both tests then passed. The characters were restored as escapes. The index test passes once ADRs 0043 to 0046 are merged.

**Consequence.** Merge E8.14 after the cards that hold ADRs 0043 to 0046, or renumber.
