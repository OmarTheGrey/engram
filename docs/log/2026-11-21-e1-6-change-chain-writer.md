---
date: 2026-11-21
author: claude-agent
type: change
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/chain.ts
  - packages/core/src/db/migrate.ts
  - packages/core/src/events.ts
  - packages/core/src/plane/offboard.ts
supersedes: none
---

**What.** Migration 5 adds the chain's side tables, and appendEvent chains each event, in its own transaction, by a skeleton whose erasable parts are salted commitments.

**Why.** ADR 0038: the log must show an edit, and an offboarding's erasure must still verify.

**Result.** The skeleton is the canonical body with an item's content, provenance ref, hash and session entry id, and a lint reason's evidence, replaced by commitments; every other field of every event type is hashed as it is. A genesis records the log's random id and the seq the chain starts at; a head row anchors size, hash and last seq. Offboarding deletes the redacted events' salts and chains one manifest of their seqs and its erase events.

**Consequence.** Event bodies and schema.ts are unchanged, so no committed result or fixture moves.
