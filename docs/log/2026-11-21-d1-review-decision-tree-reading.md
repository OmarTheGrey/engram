---
date: 2026-11-21
author: claude-agent
type: decision
card: D1
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/episode.ts
  - packages/runner/test/session-shapes.test.ts
supersedes: docs/log/2026-11-21-d1-decision-tree-reading.md
---

**What.** The parser reads every session version of 3 or more, as pi's `migrateToCurrentVersion` treats them as current. It marks an entry that a later `context_edit` on the same branch names: `context: "omitted"`, or `context: "replaced"` with the replacement text. The raw content is kept, so it is never stored as if it stood alone. Runs of omitted final-branch steps are listed in `omitted` with their stop reason, as negative evidence. The other choices of the superseded entry stand.

**Why.** pi omits a failed attempt after an overflow or a length cut (`_omitRecoveryAttempt`, docs/compaction.md). It also replaces content. Ignoring both stored withdrawn work as if it had stood.

**Result.** For each shape, the entries pi's `buildSessionProjection` leaves out equal the entries the parser marks omitted. Ten fixtures hold a recovery.

**Consequence.** Card D2 must skip or down-weight omitted steps.
