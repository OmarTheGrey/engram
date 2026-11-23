---
date: 2026-11-22
author: claude-agent
type: change
card: L7
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - packages/model/src/nli.ts
  - packages/model/test/nli.test.ts
  - docs/deps.md
supersedes: none
---

**What.** Added the real NLI scorer, its cache and a scripted scorer to packages/model, with onnxruntime-node 1.31.1 and @huggingface/tokenizers 0.2.0 as dependencies.

**Why.** Rules 6 and 7: every score is cached; the weights are fetched by sha256, never committed.

**Result.** `onnxNliScore` checks every pinned file's sha256 and the installed versions, then scores one pair per run on one thread. `cachedNli` keys each score on the model's sha256, the runtime string and the pair's hash; offline a miss is `NliMissError`. The runtime is imported only when a real scorer is built. 14 tests pass; dropping the runtime from the key fails one (mutation check).

**Consequence.** Tests and replays never load the native binding. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
