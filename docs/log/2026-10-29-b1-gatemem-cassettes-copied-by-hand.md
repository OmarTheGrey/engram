---
date: 2026-10-29
author: claude-agent
type: failure
card: B1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - Makefile
  - packages/bench/scripts/run-gatemem.ts
  - packages/bench/test/gatemem/run.test.ts
  - fixtures/bench/gatemem/cassettes
  - fixtures/bench/gatemem/judge-cassettes
supersedes: none
---

**What.** GateMem's cassettes were copied into `fixtures/` by hand, against AGENTS.md's rule that fixtures are regenerated only by `make fixtures`: the 20 answer cassettes on main (PR #6) and the 24 judge cassettes in this PR (review finding P6-3).

**Why.** `make fixtures` covered only the runner configs and the pi session fixture; `run-gatemem.ts` recorded misses under `--out`, and the copy was a manual step, which already went wrong once (`2026-10-29-b1-judge-cassettes-folder-created.md`).

**Result.** `run-gatemem.ts --record` empties the config's answer and judge cassette folders and records the scripted models into them, refusing to run offline; `make fixtures` calls it. A test records into fresh folders and compares them byte for byte with the committed ones; `make fixtures` reproduced all 44 committed GateMem cassettes unchanged.

**Consequence.** No cassette under `fixtures/` is placed by hand.
