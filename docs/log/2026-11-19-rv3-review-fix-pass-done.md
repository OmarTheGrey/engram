---
date: 2026-11-19
author: claude-agent
type: milestone
card: RV3
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - docs/tasks/RV3.md
  - docs/tasks/backlog.md
  - "make test"
supersedes: none
---

**What.** The review fix pass of card RV3 (PR #54) is done on branch rv3: blocking findings RV3-1 and RV3-2 and minor findings RV3-3 to RV3-6 are addressed, and the backlog's joined rows "Promotion carries grants" and "An event's actor capacity" are split.

**Why.** An independent review of PR #54 found them; each has its own failure entry.

**Result.** RV3-2 is fixed in core's shell check, with tests for the escaped spelling of every loopback host and a Git Bash run on a scratch store. RV3-1 is pinned by a test and documented, its core fix a backlog row for card RV4. RV3-3 and RV3-5 are corrected in superseding entries, RV3-4 pinned and documented, RV3-6 hardened with a test.

**Consequence.** Card RV4 takes the folder-move fix and RV-ADP-4 after card E2.6 merges.
