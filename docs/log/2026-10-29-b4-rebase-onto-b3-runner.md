---
date: 2026-10-29
author: claude-agent
type: decision
card: B4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/mem-inv-probe.ts
  - packages/runner/scripts/run.ts
  - Makefile
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/b4-mem-inv-probe.json"
supersedes: none
---

**What.** On rebasing B4 onto main after card B3, the MEM-INV-Bench config keeps one store, the fake, and `run.ts` refuses `--live`, `--replay` and `--model` for it.

**Why.** B3 made the runner config's `store` a store or a list and added live and replay runs for GateMem; B4's config extends that schema, and its probe builds one fake store and has no live path, which the poisoning arm's pre-registration has not asked for.

**Result.** Two conflicts, both kept on each side: `run.ts` imports and the branch before the config read, and the Makefile's `RUNNER_FIXTURES`, now one `+=` line per config. `make fixtures` after the rebase changed no file; both B4 replays make 0 new calls.

**Consequence.** Running the arm on mem0 or letta, or live, is a later card's change to `mem-inv-probe.ts`.
