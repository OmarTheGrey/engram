---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - packages/server/src/contract.ts
  - packages/cli/src/commands.ts
supersedes: docs/log/2026-11-19-e2-6-decision-stale-listing.md
---

**What.** A listed record left to the next adoption is counted under a new AdoptReport field `deferred`, carried by the HTTP contract and printed by `engram read` when non-zero.

**Why.** `unchanged` says the projection holds the record as listed, which a deferred record may not.

**Result.** `make api-check` passes after `make api`; the CLI's output is unchanged when nothing is deferred, so its tests stand.

**Consequence.** A client reading AdoptReport sees one more field; two tests that compared the whole report (`packages/cli/test/read.test.ts`, `packages/adapters/test/plane/adopt-files.test.ts`) now expect `deferred: 0`.
