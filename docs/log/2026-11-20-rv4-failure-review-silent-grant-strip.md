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
supersedes: none
---

**What.** Review finding I-4 of PR #58: a grant added by hand to an otherwise unchanged file was dropped with no event (probe P1: events added 0).

**Why.** Adoption compares the record after stripping unrecorded grants with the plane's item; equal, it counts the record unchanged and appends nothing, so the strip left no trace (AGENTS.md rule 3).

**Result.** Such a record is now gated once: one allow event naming the stripped grantee, once per store content hash. P1: allowed 1, one event; a second adoption appends nothing.

**Consequence.** The test checks the event, its reason, the unchanged item and the quiet second pass.
