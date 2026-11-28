---
date: 2026-11-28
author: claude-agent
type: decision
card: E0.6
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/backlog.md
  - docs/conventions/absorption.md
  - docs/absorbed.md
supersedes: none
---

**What.** Beyond the card's Files list, this PR edits `docs/tasks/backlog.md` (the row "The register's check" closed), `docs/conventions/absorption.md` (the row form the check reads, the `(data)` marker, the NOTICE rule) and the register's preamble.

**Why.** Review findings 1 and 5: the backlog row said the check did not exist, and the `(data)` marker and SPDX form were written nowhere, so a correct row could fail without the contributor knowing why. The coordinator asked for both fixes in this PR.

**Result.** The backlog row reads closed by card E0.6; the convention lists the form field by field.

**Consequence.** Nothing else outside the card's files changed.
