---
date: 2026-11-28
author: claude-agent
type: change
card: E0.6
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - scripts/check-absorbed.ts
  - scripts/test/check-absorbed.test.ts
  - fixtures/ci/absorbed-red/absorbed.md
  - Makefile
  - "make test-one T=scripts/test/check-absorbed.test.ts"
  - "make lint-docs"
supersedes: none
---

**What.** `scripts/check-absorbed.ts` checks every row of `docs/absorbed.md`, and `make lint-docs` runs it after the prose and log checks.

**Why.** Rule 16 and ADR 0037's decision 8 were checked only by review, and every card of the second absorb plan adds rows.

**Result.** A row fails with other than seven cells, a commit that is not a 40-character hash, a licence outside ADR 0037's copy-or-port list (CC-BY-4.0 only with a data mode), a mode neither copy nor port, no backticked landed path, a landed path that does not exist, or, for a copy, no NOTICE block naming its source and a landed path. The red fixture `fixtures/ci/absorbed-red/` breaks each once: nine problems, exit 1. Main's register passes after one fix. Six tests pass; mutants dropping the existence check and the landed-path half of the NOTICE rule each failed two.

**Consequence.** A register row review would have caught now fails `make lint-docs`.
