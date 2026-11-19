---
date: 2026-11-19
author: claude-agent
type: finding
card: RV3
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/plane/rv3-files.test.ts
  - packages/server/src/workspace.ts
supersedes: none
---

**What.** With imported ids now distinct per folder, one log still cannot hold two files folders under the same adapter name: the second folder's adoption is refused, because core keys a ref by adapter name and file name and both folders hold `files`/`user_role.md`.

**Why.** Found when the RV-ADP-2 scenario through the plane failed with "the store lists item ... at a ref item ... already holds", not with the retirement the review described.

**Result.** The refusal retires and writes nothing (test "under one adapter name, the second folder's adoption is refused and retires nothing"); with two adapter names (`files-dana`, `files-erin`) both members adopt and read their own items. Every surface opens the files store as `files` (`packages/server/src/workspace.ts`).

**Consequence.** The dogfood is unaffected (one folder and one log per member). A backlog row records the fix: an adapter-name flag, or refs that name the folder.
