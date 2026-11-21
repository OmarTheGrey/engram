---
date: 2026-11-21
author: claude-agent
type: finding
card: E1.4
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/crash-windows.test.ts
  - "make test-one T=packages/core/test/unit/plane/crash-windows.test.ts"
supersedes: none
---

**What.** Finding E14-F2: a first write into a person scope, decided before an offboarding and killed before its settling deletes its bytes, lands in the offboarded scope at the next adoption as the person's import.

**Why.** Crash-window case D5: the writer pauses before its store write, another connection completes an offboarding, the writer writes, finds its decision stale and is killed at the settling's delete.

**Result.** A live writer here is refused and deletes its bytes (R3 of cross-handle.test.ts). Killed, it leaves bytes under an id the log never recorded, after the report, which adoption cannot tell from a new memory (V-5). This is the open question ADR 0010 and offboard.ts name, now reached by a deterministic crash. Pinned in the test named `D5 (finding E14-F2)`.

**Consequence.** For the lead before the tag: whether a completed offboarding refuses such records, for example by recording decided but unsettled writes.
