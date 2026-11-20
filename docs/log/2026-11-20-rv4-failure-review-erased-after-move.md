---
date: 2026-11-20
author: claude-agent
type: failure
card: RV4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/plane/rv4-review.test.ts
  - packages/core/src/plane/offboard.ts
supersedes: none
---

**What.** Review finding I-1 of PR #58: erased content came back after a folder move. An offboarding run against a moved folder's old root recorded every item as deleted, with `left_in_store` empty and no content hashes, and the next adoption of the new root adopted all of it back into `person:dana` (P2: allowed 4).

**Why.** The adapter contract makes deleting an unknown ref a success, and the files adapter's delete of a missing file returns. The erasure took that success as proof the record was gone, and card RV4's scope-wide refusal had no hash to refuse.

**Result.** Fixed in core: the erasure reads each ref first, and a ref holding no record is not proven deleted (decision entry). Probe P2 now: allowed 0, denied 4; P2b: denied 5.

**Consequence.** The test renames the folder, offboards with the old root and adopts the new one: every record is denied with `engram/adopt/erased`.
