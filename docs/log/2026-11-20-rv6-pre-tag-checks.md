---
date: 2026-11-20
author: claude-agent
type: change
card: RV6
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/configs/smoke-h1.json
  - research/configs/b1-gatemem-reference.json
  - packages/runner/test/rv6-checks.test.ts
  - "make run CONFIG=research/configs/smoke-h1.json COUNT=1"
  - "make run CONFIG=research/configs/b1-gatemem-reference.json COUNT=1"
supersedes: none
---

**What.** Two live checks for before the tag, both `pipeline` configs that no table reads: the smoke run (`smoke-h1.json`, a suite of `smoke-h1-gatemem.json` and `smoke-h1-mem-inv.json`) and the B1 reference run (`b1-gatemem-reference.json`), with their commands in section 7 of `docs/tasks/prereg-v1-plan.md` (RV-DES-9).

**Why.** No live call has been made, so the first would be the registered H1 run; Gate B's carried criterion (a) is open.

**Result.** Offline, COUNT gives 30 GateMem sessions (6 items, C1 to C5, judge 30 to 90 calls) and 20 MEM-INV-Bench sessions (5 cases, C2 to C5, one agent note) for the smoke run, and 150 C1 sessions (judge 150 to 450 calls) for B1, with no call; `LIVE=1` under `ENGRAM_OFFLINE=1` refuses both ("live run refused: ENGRAM_OFFLINE=1 is set"). The smoke configs copy H1's store, preset, read limit, C4 verdicts and judge, which a test holds.

**Consequence.** The lead runs both after the key and before the tag.
