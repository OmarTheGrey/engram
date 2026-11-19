---
date: 2026-11-19
author: claude-agent
type: change
card: RV3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/files/rv3.test.ts
  - packages/adapters/test/letta/rv3.test.ts
supersedes: none
---

**What.** Tests now kill the review's three surviving adapter mutants M1, M10 and M11, and every RV3 fix was mutation-checked.

**Why.** The reviewer's mutation run left M1 (a files write overwrites a Claude Code file), M10 (the Letta serialise round-trip check removed) and M11 (Letta history keeps duplicate versions) alive under the whole adapters suite.

**Result.** M1: a Claude Code file named `<uuid>.md`, a write under that id refused as read-only with the bytes kept. M10: an item with a field outside the schema is refused before anything is written or committed. M11: write, delete, then rewrite of identical content gives one history version. A scratch script applied each mutant and ran the RV3 test files: M1, M10, M11, R1, R2, R5a to R5d and R10 were all killed.

**Consequence.** Nothing further; the mutation script stayed outside the repository.
