---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** For I-4, the record whose only difference is an unrecorded grant goes through the write gate once per store content, so its allow event is the gate's, with the plane's item unchanged and the dropped grantee named.

**Why.** The finding asked for one allow event; a gated adoption gives one with a real rule id and reason, where a bespoke event would need a new rule. Two guards: a deny of it never retracts the plane's item, and a retired item's record is not re-gated, which would reactivate it.

**Result.** P1: one allow event; the second adoption is quiet.

**Consequence.** A grant typed into a retired item's file leaves no event; no read admits a retired item.
