---
date: 2026-11-23
author: claude-agent
type: change
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/review.test.ts
  - packages/cli/src/tui/app.ts
supersedes: none
---

**What.** E8.15b's test "M12: the export confirmation says whether the file exists" in `packages/cli/test/tui/review.test.ts` now expects "old.bundle exists: it will be overwritten" and "new.bundle does not exist yet: it will be created", in place of "it exists and will be overwritten" and "it does not exist yet".

**Why.** E8.15d's review asked for the overwrite note to name the file. The test pins what the note says, whether the file exists; that is kept, only the words changed.

**Result.** review.test.ts passes; a mutant inverting the file check still fails it.

**Consequence.** The E8.15b review's M12 finding stays covered.
