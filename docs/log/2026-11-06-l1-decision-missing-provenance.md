---
date: 2026-11-06
author: shady
type: decision
card: L1
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/det.ts
  - fixtures/faults/missing-provenance.flag.json
supersedes: none
---

**What.** missing-provenance flags weak provenance: kind model or compaction without `model`, kind compaction without `session_entry_id`, or a ref that is only whitespace.

**Why.** The plan asked for `kind: session` without `session_entry_id`, but ProvenanceKind has no session kind; compaction is the kind derived from a session, so it takes that rule. The schema already refuses an empty ref, so blank means whitespace only.

**Result.** The flag fixture holds a model write naming no model and a compaction naming no session entry; the near-miss holds complete ones and a user write with neither field.

**Consequence.** The pi extension omits `model` when the session has none, so such writes are flagged; that is the intended signal.
