---
date: 2026-11-20
author: claude-agent
type: failure
card: RV4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/plane/rv4-files.test.ts
supersedes: none
---

**What.** Three new tests failed on their first run for a reason in the tests, not in the fix: the hand edits never changed the item's content.

**Why.** The files adapter writes an item's first line into the frontmatter's `name`, so replacing the content's text replaced the name instead of the body; and the body helper appended a newline the adapter keeps as content.

**Result.** A debug script on a scratch folder showed the adoption `unchanged: 1`; the tests now edit the body after the frontmatter, with no added newline, and all 10 pass.

**Consequence.** None for the code.
