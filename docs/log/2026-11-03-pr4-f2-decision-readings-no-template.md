---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - Makefile
  - packages/runner/scripts/h1-sessions.ts
supersedes: none
---

**What.** P4V-4 is answered both ways it offered. `make h1-table READINGS=` passes no `--unread-out`, and the converter refuses `--readings` and `--unread-out` that resolve to the same file.

**Why.** The Makefile change covers the documented route. The refusal covers a direct call to the converter.

**Result.** A test passes the same file under two spellings and checks that it is refused and the readings survive. Another checks with `make -n` that the recipe writes no template when `READINGS` is set.

**Consequence.** Rerunning without `READINGS=` rewrites the template and its key, both identical for the same run and seed.
