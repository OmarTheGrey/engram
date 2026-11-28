---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.17
chapter: related-work
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/E2.17.md
supersedes: none
---

**What.** caura's recall explanation (core-api/src/core_api/services/recall_explain.py, Apache-2.0, commit 8dbb7f40a76c) is taken as an idea only, as the card names it: the approach that a recall explains what it left out. Its source was not opened and no code follows it.

**Why.** No network fetch is needed for an idea, and the stage logic is the read's own.

**Result.** Cited in the module header; no row in docs/absorbed.md or NOTICE, which hold copies and ports only.

**Consequence.** None.
