---
date: 2026-11-06
author: claude-agent
type: decision
card: L1
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/det.ts
  - fixtures/faults/source-changed.flag.json
supersedes: none
---

**What.** source-changed flags an item whose `provenance.ref` names a logged item (its UUIDv7 id, bare or as `item:<id>`) whose content now has a strict content hash (`strictContentHash`, ADR 0018) other than `provenance.hash`.

**Why.** No surface writes refs that name items yet (they name tool calls or the CLI), so only an item id can be resolved without store I/O. The strict form keeps whitespace-only rewrites from flagging, while any change of wording or case flags.

**Result.** The flag fixture rewrites the source with new wording; the near-miss rewrites it with extra whitespace only and refers to it as `item:<id>`. A source the actor cannot reach is skipped here and reported by orphan.

**Consequence.** A writer that wants this lint must record the strict hash of its source in `provenance.hash`.
