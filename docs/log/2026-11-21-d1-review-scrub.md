---
date: 2026-11-21
author: claude-agent
type: change
card: D1
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/scrub.ts
  - packages/core/src/plane/bypass.ts
  - packages/core/test/unit/distill/scrub.test.ts
supersedes: docs/log/2026-11-21-d1-scrub.md
---

**What.** `scrubEpisode` runs the bypass redactor's table (`redactSecrets`) and then a rule of its own for named values: `X-Api-Key: v`, `"token": "v"`, `password: v`, `DB_PASS=v` and `Authorization: Basic v`. Under a secret-named argument it removes the whole value.

**Why.** The superseded entry cited rule 12 as "no secret is stored". Rule 12 is about dogfood content, and the table is a list of shapes, not a complete detector. The review found array, object and header values kept.

**Result.** 27 scrub tests pass. Known limits, tested as kept: a secret with no telltale shape, such as a bare short password in prose, and a key split across two fields or messages. The named-value rule lives in the scrub, so the table and every bypass reason are byte-identical.

**Consequence.** Card E2.9's guard is the detector. It may move the named-value rule into the shared table.
