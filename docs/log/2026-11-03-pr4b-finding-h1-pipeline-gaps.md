---
date: 2026-11-03
author: claude-agent
type: finding
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - research/analysis/h1.py
  - research/configs/h1-table.json
  - research/results/h1-gatemem-reach.json
supersedes: none
---

**What.** Two gaps stand between the recommended protocol and the H1 pipeline: the converter and the table pool GateMem's access and forgetting checkpoints, and the H1 table's input is not in the repository.

**Why.** Writing the readiness record meant checking each step of the chain against v1 and rule 9.

**Result.** `h1-sessions/1` has one GateMem label and no checkpoint kind, so item 9's primary set needs a split; `research/results/h1-gatemem-reach.json` counts the refusal-leak checkpoints but lists no ids, which item 10's sensitivity table needs. `make h1-table` reads `.engram/runs/h1-sessions.jsonl`, which git ignores, so `make test-repro` could not regenerate `research/results/h1-table.json` from the repository.

**Consequence.** The plan's section 7 places the first before the tag and the second in the PR that commits the table.
