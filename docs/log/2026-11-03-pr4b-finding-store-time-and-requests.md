---
date: 2026-11-03
author: claude-agent
type: finding
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - fixtures/cassettes/x1-h1-mem-inv
  - fixtures/cassettes/b3-gatemem-plane
  - research/results/h1-c4-verdict-agreement.json
  - "ENGRAM_OFFLINE=1 node packages/runner/scripts/run.ts --config <b3-gatemem-plane.json with one store> --out <scratch folder>"
supersedes: none
---

**What.** The model's requests do not depend on the store, replays on Mem0 take as long as on fake, and Letta's commit per write makes it far slower.

**Why.** Decision sheet item 2 asks what each store costs in time and fidelity.

**Result.** Every session in `fixtures/cassettes/x1-h1-mem-inv` (9 per store, 49 calls) and `fixtures/cassettes/b3-gatemem-plane` (3 per store, 18 calls) has byte-identical requests on fake, Mem0 and Letta. Replaying the B3 probe on one store at a time (3 C5 sessions, 474 writes) took 9.8 s on fake, 8.5 on Mem0 and 108 on Letta, once each on a loaded machine: about 0.2 s per Letta write. GateMem's arm writes each checkpoint's turns in each of its 12 sessions: 325,530 turn items (`research/results/h1-c4-verdict-agreement.json`) times 12, about 3.9 million writes, nine days on Letta at that rate.

**Consequence.** The store changes time and fidelity, not the requests.
