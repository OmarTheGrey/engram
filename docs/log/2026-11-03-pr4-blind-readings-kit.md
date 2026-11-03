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
  - packages/runner/test/research/h1-sessions.test.ts
  - research/tests/test_h1_pipeline.py
  - "make h1-table"
supersedes: none
---

**What.** `make h1-table` writes the UNREAD replies blind. `.engram/runs/h1-unread.json` (`h1-blind-readings/1`) gives each reply an opaque id in an order `research/configs/h1-table.json`'s seed shuffles. Beside it, `.engram/runs/h1-unread-key.json` maps ids to sessions. `READINGS=<filled copy>` joins the copy back through the key.

**Why.** Decision sheet item 14 recommends reading blind to the condition; the old template named it.

**Result.** The tests check four things:
- no template field names a condition, store, seed or item, and the order is not the sessions';
- a filled template gives the same sessions and table as the same readings keyed directly;
- a tampered key, another run's key, or a missing key is refused;
- every earlier refusal holds.

Three mutants (order, key match, reply hash) are killed. No result changed.

**Consequence.** Someone who does not read hands over the template and keeps the key.
