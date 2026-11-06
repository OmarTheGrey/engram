---
date: 2026-11-06
author: claude-agent
type: decision
card: E9.7
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0010-retention-retires.md
  - packages/core/src/events.ts
supersedes: none
---

**What.** Erasure redacts the content, provenance ref and evidence hash of the erased items in every earlier event, and an erasure event (`engram/offboard/erase`) makes the projection and replay drop them; the events and their decisions stay.

**Why.** Write events carry the item they wrote, so deleting the store's bytes and the projection's row alone would leave the content in the log, and `rebuild()` would bring the items back. Crypto-shredding would need encrypted payloads, a schema and storage change; an `erase` op would be a schema PR.

**Result.** ADR 0010 amended; it is the one rewrite of the append-only log. The hash is redacted too, since a hash of a short note can be guessed.

**Consequence.** The lead may prefer an ADR of its own, or an `erase` op in a later schema PR.
