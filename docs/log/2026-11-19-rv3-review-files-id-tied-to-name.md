---
date: 2026-11-19
author: claude-agent
type: change
card: RV3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/files/index.ts
  - packages/adapters/test/files/rv3.test.ts
  - packages/adapters/test/plane/rv3-files.test.ts
supersedes: docs/log/2026-11-19-rv3-files-id-tied-to-name.md
---

**What.** The files adapter refuses an Engram file whose `engram.id` is not its file name (review finding RV-ADP-1): `list` and `search` skip it with a diagnostic, `read` and `delete` throw `UnreadableItemError`. It stops copies and mismatched names, not forgery.

**Why.** A copy of `<id>.md` listed the id twice, adoptions of the unchanged folder appended events, and after a rewrite the stale copy's adoption retired the governed version (probe `forge.mts`, parts 1 and 3).

**Result.** Tests: one listed item, the copy reported, no events from repeated adoptions, the owner reads version 2. A file written by hand under its own new id's name, with Engram metadata and grants, is still read and adopted with its grants (`forge.mts`, part 2): that is RV-ADP-4, deferred to card RV4.

**Consequence.** One id names one file in the folder.
