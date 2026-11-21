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
supersedes: docs/log/2026-11-21-d1-review-decision-tree-reading.md
---

**What.** The parser reads versions of 3 and above. It marks edited steps `omitted` or `replaced` and keeps the raw content. It lists omitted attempts, one per omitted generation with its tool results. Times that are not ISO 8601 are kept as null. The rest of the superseded entry stands.

**Why.** pi withdraws attempts on two paths (`_omitRecoveryAttempt`). After an overflow or a length cut, it omits the attempt and its results, compacts, and retries. After a retryable error (`_prepareRetry`), it omits that one response and retries, once per failure. Merging consecutive retries counted two failures as one.

**Result.** The shape user, error, edit, error, edit, stop gives two attempts, both written by hand and written by pi. pi's projection agrees with the marks and replacements on ten shapes.

**Consequence.** Card D2 counts each failed retry.
