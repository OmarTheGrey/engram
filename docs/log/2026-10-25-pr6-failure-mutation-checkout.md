---
date: 2026-10-25
author: claude-agent
type: failure
card: PX1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/check.test.ts
  - packages/core/src/plane/write.ts
supersedes: none
---

**What.** Undoing a mutation check with `git checkout` on packages/core/src/plane/write.ts also discarded the uncommitted checkWrite refactor in that file.

**Why.** The mutant was made with sed on a file that already held uncommitted work, and checkout restores the committed version, not the one before the mutant.

**Result.** The refactor was restored from a copy taken before the mutant; the plane unit tests passed again (90 tests). Every later mutation check copied the file to the scratchpad first and restored that copy, compared byte for byte.

**Consequence.** Mutants are undone from a copy, never with checkout, while work is uncommitted.
