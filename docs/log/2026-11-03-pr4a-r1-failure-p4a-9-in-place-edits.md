---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/log/2026-11-03-pr4a-failure-c4-test-after-code.md
  - docs/log/2026-11-03-pr4a-failure-commit-past-lint-docs.md
  - docs/log/2026-11-03-pr4a-failure-x1r2-b3-reads-edited-in-place.md
supersedes: none
---

**What.** Part A's commit `68cbbd5` edited two of its own log entries in place, `pr4a-failure-c4-test-after-code` and `pr4a-failure-commit-past-lint-docs`, removing the pre-rebase hashes `cc14a86` and `dc0e139`, and left no note.

**Why.** After the rebase onto PR 2's merge the hashes named commits no longer on the branch; the entries were unmerged, so they were corrected in place, but part A's own N-3 entry says such a correction is logged, and it was not. Found by the review (P4A-9).

**Result.** This is that note. The first entry now says "with the work committed first" where it named `cc14a86`; the second names "the commit that added the H1 pipeline's log entries" where it named `dc0e139`. No other word changed.

**Consequence.** A log entry names no branch hash that a rebase or a squash will remove.
