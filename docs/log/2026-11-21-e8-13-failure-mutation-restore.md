---
date: 2026-11-21
author: claude-agent
type: failure
card: E8.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/export/otel.ts
  - "make test-one T=packages/core/test/unit/export/otel.test.ts"
supersedes: none
---

**What.** After the mutation check on `packages/core/src/export/otel.ts`, `git checkout --` did not restore the file, because it was not yet tracked.

**Why.** The mutation was made before the file's first commit.

**Result.** It was restored from the copy taken before the mutation. Verified: `diff` against the copy printed nothing, the mutated line (`"engram.reason": event.reason`) occurs zero times, and the test passes 38 of 38. Later mutation checks were made only on committed files.

**Consequence.** Mutate committed files only.
