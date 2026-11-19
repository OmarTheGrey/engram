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
supersedes: none
---

**What.** An imported file's id derives from its folder and file name, not from its owner and file name as the review proposed.

**Why.** Adoption refuses a record an offboarding erased by its item id (`engram/adopt/erased`). With owner-derived ids, a successor adopting a leaver's unchanged folder under another owner gets new ids and would adopt the erased content again; `offboard-files.test.ts` guards that. Folder-derived ids separate two members' folders, as RV-ADP-2 needs, keep the successor's ids, and also separate one person's two project folders.

**Result.** The collision tests and every offboarding test pass. Cost if wrong: moving or restoring a folder to another path changes its imported ids, so its files are adopted again as new items, the old ones retired, and the erased-content guard does not follow the folder.

**Consequence.** ADR 0013's amendment of card RV3 states it, status proposed. No dogfood log exists, so no id is migrated.
