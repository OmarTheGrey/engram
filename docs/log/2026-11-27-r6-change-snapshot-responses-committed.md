---
date: 2026-11-27
author: claude-agent
type: change
card: R6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/configs/openrouter-endpoints.json
  - research/configs/openrouter-endpoints/2026-11-26/deepseek_deepseek-v4-pro-0813.json
  - packages/runner/test/rv6-endpoints.test.ts
  - biome.json
  - "make test-one T=packages/runner/test/rv6-endpoints.test.ts"
supersedes: none
---

**What.** The four endpoint responses of 2026-11-26 are committed as served under `research/configs/openrouter-endpoints/2026-11-26/`, and each snapshot entry names its file (`response`) and now records every endpoint's full `supported_parameters`. A new test hashes each file against `response_sha256` and rebuilds every endpoint entry from it. Biome skips the folder, since a reformat would change the hashed bytes.

**Why.** Review finding 7: the hash named responses nobody could read, and the `seed` flags were transcribed by hand. Finding 2 needs the full parameter lists.

**Result.** 20 of 20 tests pass. Mutation: setting DeepSeek's own endpoint to `seed: true` fails the rebuild test and the rule's pin tests; restored.

**Consequence.** Every seed flag and price in the snapshot can be checked offline.
