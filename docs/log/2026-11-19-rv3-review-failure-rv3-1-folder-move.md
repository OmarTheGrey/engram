---
date: 2026-11-19
author: claude-agent
type: failure
card: RV3
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/plane/rv3-files.test.ts
  - packages/core/src/plane/write.ts
  - docs/decisions/0013-adapter-contract-and-conformance.md
supersedes: none
---

**What.** Review finding RV3-1 (blocking): after an adopted files folder is moved, every adoption, and so every `engram read`, fails, while ADR 0013's amendment said the moved files are adopted again and the old ones retired.

**Why.** A move gives each file a new imported id at the same ref `files/<name>.md`. Core's `refProblem` counts retired holders too, so adoption throws before it retires what the store no longer lists. The amendment was written from the adapter's side without running a move through the plane.

**Result.** A test pins the real behaviour: two adoptions of the moved folder each throw and leave one `engram/write/store-failure` deny event, the projection is unchanged, and moving the folder back adopts with nothing changed. ADR 0013, `docs/dogfood.md` (a recovery note) and a backlog row for the core fix (card RV4, after E2.6) state it.

**Consequence.** Core is not changed here: card E2.6 rewrites `write.ts` and `adopt.ts`.
