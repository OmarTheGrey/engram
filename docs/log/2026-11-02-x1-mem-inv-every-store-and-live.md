---
date: 2026-11-02
author: claude-agent
type: change
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/mem-inv-probe.ts
  - packages/runner/src/live.ts
  - packages/runner/scripts/run.ts
  - packages/runner/test/x1-mem-inv.test.ts
supersedes: none
---

**What.** The MEM-INV-Bench probe runs on every store (fake, Mem0, Letta) and takes `--live`, `--replay` and `--model` like GateMem's, with the same cassette discipline; `run.ts` no longer refuses them for this benchmark.

**Why.** Plan decision 5: H1's poisoning arm must start with one command once a key exists.

**Result.** `live.ts` is generic over the config's benchmark. With pi-ai's faux provider on the seeded API, a live MEM-INV-Bench run records 2 calls with seed 1, a rerun makes 0 new calls, and a replay offline makes 0; the command refuses `--live` under `ENGRAM_OFFLINE=1` before any session. On Mem0 and Letta, C2 and C5 reads show the case's memory as on the fake. No live call was made.

**Consequence.** `make run CONFIG=research/configs/h1-mem-inv.json MODEL=<M1> LIVE=1` is the arm's command once the key exists.
