---
date: 2026-11-19
author: claude-agent
type: decision
card: RV3
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0013-adapter-contract-and-conformance.md
  - packages/core/src/plane/adopt.ts
  - packages/adapters/test/plane/offboard-files.test.ts
  - packages/adapters/test/plane/rv3-files.test.ts
supersedes: docs/log/2026-11-19-rv3-decision-imported-id-folder-not-owner.md
---

**What.** An imported file's id derives from its folder and file name, not from its owner and file name as the review proposed; this entry corrects the cost the first one stated.

**Why.** Adoption refuses erased content by item id (`engram/adopt/erased`), so owner-derived ids would let a successor adopting a leaver's unchanged folder under another owner take the erased content back. Folder-derived ids separate two members' folders, as RV-ADP-2 needs, and keep the successor's ids. The first entry's claim that they separate one person's two project folders is dropped: one log cannot hold two folders named `files`.

**Result.** Cost if wrong, as tested: after a folder move every adoption and `engram read` fails closed with one deny event per attempt, nothing lost and no erased content back; moving the folder back recovers, otherwise only a new log does.

**Consequence.** Card RV4 makes adoption handle a move, after card E2.6.
