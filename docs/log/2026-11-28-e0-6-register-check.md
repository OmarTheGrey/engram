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

**Result.** A row fails on a cell count other than seven, a short commit, a licence expression with a part outside ADR 0037's list (CC-BY-4.0 only on a `(data)` mode), a mode neither copy nor port, no backticked landed path, a missing landed path, or a copy with no NOTICE block naming its repository and a landed path whole. A table row after a blank line is reported. The red fixture `fixtures/ci/absorbed-red/` gives 13 problems and passes its eight clean rows; main's register passes after two row fixes. 16 tests pass; 17 mutants were each killed.

**Consequence.** A register row review would have caught now fails `make lint-docs`.
