---
date: 2026-11-28
author: claude-agent
type: change
card: X19
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/bench/src/residue/check.ts
  - packages/bench/test/residue/check.test.ts
  - fixtures/cassettes/x19-erasure-residue
  - make test-one T=packages/bench/test/residue/check.test.ts
supersedes: none
---

**What.** The check's workspace, canaries, backends and stores (`packages/bench/src/residue/`), its script `packages/bench/scripts/erasure-residue.ts`, 20 scripted summary cassettes recorded by a line of `make fixtures`, and `research/scripts/h3_erasure_residue.py` with its tests.

**Why.** U7's design: derived tiers per person (summary, candidate, promotion, shared ref, lint events, explanation), E1.7's two store paths, and the byte tiers the log and store cannot see.

**Result.** Bench tests pass (8, two persons, SQLite with the MCP file and files, byte-stable on a second run); pytest 5 pass. Mutation: letting the read-only store delete fails the store-records test on both stores.

**Consequence.** `make test-repro` reruns the row, about 12 minutes.
