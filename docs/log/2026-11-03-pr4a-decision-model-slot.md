---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-table.json
  - research/configs/h1-gatemem.json
  - packages/runner/scripts/h1-sessions.ts
supersedes: none
---

**What.** H1 sessions name the runner config's model, so the live arms' sessions name the pre-registration's slot `prereg/M1`, and `research/configs/h1-table.json` names `prereg/M1` as the primary model and `fake` as the store.

**Why.** The H1 configs name the slot and the command line names the model that fills it (PR 3); a table config naming a concrete model would need an edit between the live runs and the table, against "three commands with nothing missing".

**Result.** The converter reads the model that filled the slot from the run's usage ledger, prints it, and refuses a run whose ledger names two answer models; v1's Models table says which model M1 is. The store `fake` follows PR 3's placeholder in both H1 configs; part B changes all three together if v1 names another store.

**Consequence.** If wrong, the table names the slot rather than the model; one config field changes it.
