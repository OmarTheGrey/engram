---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.13
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/export/otel.ts
  - packages/core/src/plane/bypass.ts
  - "make test-one T=packages/core/test/unit/export/otel.test.ts"
supersedes: none
---

**What.** Each reason template family is kept only on the ops whose reasons it comes from: the write gate's (with the provenance note, the injection screen and the content guards) on write, update, promote and gate; the read's counts on read; retention's on retire and evict; the bypass record's on bypass_blocked; none on lint.

**Why.** The lead asked for every reason producer under `packages/core/src` to be checked for free text before a templated clause. `plane/bypass.ts` starts its reason with `${bypass.store}`, which the `/bypass` route takes from the request body, so a store of `returned 1 of 2 candidates; it targets person:<secret>; mem0` passed every clause even under the withhold-the-rest rule. Actor ids also stand first but are exported as `engram.actor` by design.

**Result.** Tested on a real Plane, routes command and path.

**Consequence.** A store name is still kept as one token in its slot, as an identifier.
