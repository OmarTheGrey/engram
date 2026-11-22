---
date: 2026-11-21
author: claude-agent
type: decision
card: X14
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/configs/redteam.json
  - packages/bench/src/redteam/run.ts
supersedes: none
---

**What.** No stage of the harness calls a model, so it has no cassettes and the card's folder `fixtures/cassettes/x14-redteam-fixture/` is not created.

**Why.** Proposal P1 is model-free (AMSB's canary rule, zero model calls); a cassette folder with no call in it would prove nothing, and git keeps no empty folder.

**Result.** `make redteam` runs its corpus under `ENGRAM_OFFLINE=1` with no ModelCall anywhere; the acceptance's "offline from cassettes" holds with zero calls.

**Consequence.** A live sub-arm, where a model acts on what survived, would add the scripted model and its cassettes; it is its own proposal. Cost if wrong: one folder and a scripted reader.
