---
date: 2026-11-20
author: claude-agent
type: failure
card: RV4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/plane/rv4-review.test.ts
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** Review finding I-9 of PR #58: `rekeyedRefusal` compared content by `canonical`, so a case-only edit of a re-keyed record whose item was retired by its owner brought it back under the new id.

**Why.** The erased refusal compares by the merging hash (case, width and invisible characters aside); the re-keyed refusal did not.

**Result.** It now compares merging hashes. The test retires a file's item, moves the folder, upper-cases the file's body, and the record is refused with `engram/adopt/rekeyed`.

**Consequence.** Both refusals now judge "the same content" alike.
