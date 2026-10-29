---
date: 2026-10-29
author: claude-agent
type: failure
card: B1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/scripts/run-gatemem.ts
  - fixtures/bench/gatemem/judge-cassettes
supersedes: none
---

**What.** Recording the judge cassettes the first time created an empty `fixtures/bench/gatemem/judge-cassettes` folder, and copying the recorded ones then nested them one level down, so the offline replay missed every judge key.

**Why.** `run-gatemem.ts` opened the committed cassettes with `fileCache`, which creates its folder; a committed folder that did not exist yet was made empty instead of being treated as absent.

**Result.** The committed folder is now opened only when it exists (otherwise an empty in-memory cache stands in), the 24 cassettes sit at the folder's top level, and `ENGRAM_OFFLINE=1 make bench BENCH=gatemem` replays them with 0 new calls.

**Consequence.** The read-only rule of finding R6-5 also covers a committed cassette folder that does not exist yet.
