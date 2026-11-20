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
  - packages/core/src/events.ts
supersedes: none
---

**What.** Verification finding N-3 of PR #58: after a not-found erasure, with the folder moved back and a new file written under an erased id, the file was refused by id forever (P32), where the same file after an ordinary erasure adopts (P33).

**Why.** The first fix pass refused a record under a not-found erased id whatever it held, and the plane's delete of it fails on a read-only file, so nothing ever cleared it.

**Result.** A not-found erasure now refuses the id only while it holds the erased content, as the left-in-store path does (`keptInStore`, events.ts). P32 and P33 both adopt the new file and refuse the three unchanged ones.

**Consequence.** This reverses the first pass's decision entry on not-found ids (decision entry).
