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
  - packages/core/src/plane/commit.ts
  - "make test-one T=packages/core/test/unit/plane/crash-windows.test.ts"
supersedes: none
---

**What.** Finding E14-F5: a stale writer killed before its settling writes the committed version back leaves its own refused bytes in the store, and the next adoption records them as the owner's import over the committed write.

**Why.** Review finding E1.4-3. A pauses before its store write; B's rewrite commits; A writes, finds its decision stale, and is killed at the settle's write-back (`settle` in plane/commit.ts; plane/grants.ts's conflict path).

**Result.** Crash cases W7 (a rewrite) and G3 (a grant change), on SQLite and Postgres: after recovery the projection holds A's refused text (W7) or the content B replaced (G3), kind import. Killed just after the write-back (W7b, G3b), recovery appends nothing. This breaks commit.ts's rule that recovery never undoes a committed owner decision.

**Consequence.** For the lead before the tag: the write-back needs a mark the next adoption can see, as the offboarding's begin mark is.
