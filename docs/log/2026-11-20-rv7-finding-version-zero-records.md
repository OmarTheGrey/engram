---
date: 2026-11-20
author: claude-agent
type: finding
card: RV7
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/plane/version-zero-files.test.ts
  - "pnpm exec vitest run test/plane/version-zero-files.test.ts (in packages/adapters)"
supersedes: none
---

**What.** RV-CORE-10 was reproduced in part: a files-adapter record at `schema_version: 0` is never migrated.

**Why.** The review guessed that adoption refuses each such record with a schema deny while the projection keeps serving it.

**Result.** What actually happens is worse for the person. The adapter skips the file as unreadable, with the schema error in its diagnostics. The next adoption then retracts the projected item: one allowed `retire` (`engram/adopt/retract`) whose reason quotes the schema error. The item leaves every read. The test pins this, so a fix must change it on purpose.

**Consequence.** No fix here: upgrading on read belongs in the adapter or in `adopt.ts` (card RV4's file). The backlog row "Version 0 workspaces" is widened.

