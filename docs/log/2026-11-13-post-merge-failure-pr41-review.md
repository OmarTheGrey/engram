---
date: 2026-11-13
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/plane/offboard-files.test.ts
  - packages/core/test/unit/plane/offboard-edges.test.ts
supersedes: none
---

**What.** The adversarially verified review of PR #41 found three defects in its own fixes.

**Why.** The keep-back path for failed deletes treated the files adapter's ReadOnlyItemError, thrown for every adopted Claude Code memory file, as transient, so offboarding never erased adopted files. Lint redaction matched any erased item's hash, so it erased duplicate and source-changed findings about surviving items sharing that text or source. The read's re-check ran before its transaction took the log's lock, so an erasure by another process could still land between them.

**Result.** Adapter contract gains `NotDeletableError`; a permanent refusal erases and reports `left_in_store`. A hash counts only when no survivor holds it. The re-check moved inside the transaction. The adoption and read parts were redone after a recheck (`docs/log/2026-11-13-post-merge-failure-pr41-recheck.md`). Each fix was broken on purpose to show its test fails.

**Consequence.** Tests of erasure now run over the real files adapter too.
