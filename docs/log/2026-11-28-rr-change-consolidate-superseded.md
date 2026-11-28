---
date: 2026-11-28
author: claude-agent
type: change
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/consolidate_log.py
  - research/tests/test_consolidate.py
  - docs/conventions/documentation.md
  - research/thesis/drafts/results.md
supersedes: none
---

**What.** `research/scripts/consolidate_log.py` no longer holds a superseded entry to the measurement rules, and `make thesis` rebuilt `research/thesis/drafts/`.

**Why.** Entries are immutable, so a measurement entry with no MANIFEST results file or bare config path can only be corrected by superseding it; before, the old entry still failed validation and blocked every draft.

**Result.** Before: a superseded measurement was checked for its MANIFEST row and config like a current one. After: it is still checked for its fields, values, body and evidence paths, and is left out of every draft as before. Two tests pin it: a superseded measurement without a config consolidates, and a superseded entry with a missing evidence path is still refused. Rule 5 of `docs/conventions/documentation.md` says so.

**Consequence.** The drafts are current as of 2026-11-28.
