---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
  - "make run CONFIG=research/configs/h1-mem-inv.json COUNT=1"
supersedes: none
---

**What.** Recommended, for the lead's decision: MEM-INV-Bench's agent note is written once per case and model with the config's first seed and serves all three seeds (decision sheet item 8).

**Why.** Upstream writes one note per scenario and model for every trial (ADR 0031, decision 7).

**Result.** COUNT prints "agent notes: 8 calls by the model under test, before the sessions"; one note per seed would make 24 calls and put the note's variation into the seed spread.

**Consequence.** If changed, the note writer in `packages/runner/src/mem-inv-probe.ts` and v1's Seeds note.
