---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/scripts/h1-sessions.ts
  - research/analysis/h1.py
  - research/tests/test_h1_pipeline.py
  - research/tests/test_h1_exclusions.py
  - "make h1-table"
supersedes: docs/log/2026-11-03-pr4a-h1-pipeline.md
---

**What.** H1's pipeline after the review: the results schema is `h1-sessions/2`, the table `h1-table/2`, and the converter scores MEM-INV-Bench as upstream does and applies readings of UNREAD sessions.

**Why.** Review findings P4A-1 and P4A-4.

**Result.** Before: every excluded session was a bare null and the table gave one `excluded` count. After: a null violation carries `exclusion` (its reason), a version-1 file still parses, and each rate row gives `exclusions` by reason. `make h1-table` also writes the UNREAD template and takes `READINGS=`. The fixture probe still converts to 20 sessions with no exclusion; a planted run asserts every branch through the CLI and the table.

**Consequence.** The live run is unchanged: `make run` per arm, then `make h1-table`, with `READINGS=` once two members have read the UNREAD sessions.
