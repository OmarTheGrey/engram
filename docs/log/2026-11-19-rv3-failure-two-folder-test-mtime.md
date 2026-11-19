---
date: 2026-11-19
author: claude-agent
type: failure
card: RV3
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/plane/rv3-files.test.ts
supersedes: none
---

**What.** The RV-ADP-2 test through the plane failed twice after the fix, each time for a reason other than the defect.

**Why.** First, both folders were adopted under the adapter name `files`, and core refused the second folder's ref (the finding entry of card RV3 on one log and two folders). Second, with two adapter names, the members read nothing: the imported files took `valid_from` from their modification time, the test's run day, which lies after the read time the test used, so the read filtered both as outside their validity window.

**Result.** The test now uses two adapter names and `importValidFrom` before the read time, and passes; a separate test pins the refusal under one name. Found with a throwaway debugging test that printed the read's reason, deleted afterwards.

**Consequence.** Nothing beyond the finding entry.
