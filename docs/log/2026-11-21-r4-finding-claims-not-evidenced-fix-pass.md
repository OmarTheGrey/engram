---
date: 2026-11-21
author: claude-agent
type: finding
card: R4
chapter: limitations
pillar: govern
hypothesis: none
evidence:
  - research/results/h1-crosswalk.json
  - docs/tasks/backlog.md
  - docs/conventions/testing.md
supersedes: docs/log/2026-11-21-r4-finding-claims-not-evidenced.md
---

**What.** Four claims have no test: C30 (reinstatement by event), C44 (decision and event times injected), C48 (procedures retired on drift), C50 (Gate D's dogfood).

**Why.** C44 was first stated as "nothing in packages/core reads the clock", which is false: `packages/core/src/db/postgres-worker.ts` (lines 34, 41, 54) and `postgres.ts` (lines 211, 229) call `Date.now()` for transport timeouts. It is restated as injected decision and event times, which no test or lint rule checks.

**Result.** `docs/conventions/testing.md` carries a one-line correction. Each of the four has a backlog row naming what closes it: a reinstatement surface first (C30), a lint rule (C44), card D3 (C48), the dogfood's reports (C50).

**Consequence.** The thesis states these as design intent, not evidenced properties.
