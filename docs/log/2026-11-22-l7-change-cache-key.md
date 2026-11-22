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
  - fixtures/cassettes/l7-nli-scores
supersedes: none
---

**What.** Added the tokenizer's sha256 and a scorer version (`engram-nli-scorer/1`) to every NLI cache key, and re-recorded the 248 score cassettes.

**Why.** Review L7-5, the lead's decision: a changed tokenizer or scoring code must not be answered by an old score.

**Result.** Before, a key held the model's sha256, the runtime and the pair's hash. Re-recorded with `--record-nli` from the pinned model already under .engram/upstream: all 248 scores byte-identical to the old ones, every key changed. Both fixture configs then replayed twice with 0 new model calls and 0 new scores (452 and 72 from cassettes).

**Consequence.** Raise NLI_SCORER_VERSION whenever the encoding, truncation, threading or softmax changes. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
