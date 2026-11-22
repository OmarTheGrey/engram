---
date: 2026-11-22
author: claude-agent
type: decision
card: D3
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - docs/tasks/D3.md
supersedes: none
---

**What.** Card D3 edits files beyond its list (`packages/core/src/distill/`, its tests, `packages/runner/src/`, the config, the cassettes, `docs/log/`), each because the card's steps need it (review finding D3-12).

**Why.** Admission must go through `Plane.promote`, so: `plane.ts`, `plane/promote.ts` and `policy/promotion.ts`. Core: `dogfood.ts` (rule ids), `index.ts`, `oracle.ts` and `invariants.test.ts` (D3-5). Runner: `scripts/run.ts` (dispatch). Also `fixtures/distill/d3-validate/`, `Makefile` and `AGENTS.md`/`CLAUDE.md` (the fixture and its command), `scripts/test/tasks-and-decisions.test.ts` (`OWNER_DECIDES`), and ADR 0045 with the index and lead-decisions item 63.

**Result.** Each is listed in the pull request description.

**Consequence.** A reviewer checks those beside the card's own files.
