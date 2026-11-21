---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.8
chapter: implementation
pillar: plane
hypothesis: H1
evidence:
  - packages/runner/src/conditions.ts
  - packages/model/src/cached.ts
  - packages/bench/scripts/fault-set.ts
  - research/configs/h3-lint-model.json
  - "grep -l 'memory-policy' fixtures/cassettes/*/* | wc -l"
supersedes: none
---

**What.** Card E2.8 stopped before any change: bumping `schema_version` moves committed cassette keys and pinned H3 hashes.

**Why.** The brief requires a stop when the bump moves a cassette key or a result's bytes.

**Result.** The policy shares `SCHEMA_VERSION` with items and events. `policyInstruction` puts the parsed policy, `schema_version` included, into the C3 and C4 prompts, and `cacheKey` hashes the prompt, so 46 cassettes move: 16 of 56 in x1-h1-gatemem, 24 of 49 in x1-h1-mem-inv, 4 of 4 in x1-h1-gatemem-rag, 2 of 6 in rn1-gatemem-probe. The fault-set generator writes `schema_version: 1` into `policy.json` and `states.jsonl`, whose sha256 `research/configs/h3-lint-model.json` pins. A probe parsing the three presets with both blocks optional, no default, gave today's JSON; at version 2, it differed.

**Consequence.** The lead chooses: optional blocks and no bump; a policy accepting version 1 or 2, presets left at 1; or the bump, with cassettes and fault sets regenerated.
