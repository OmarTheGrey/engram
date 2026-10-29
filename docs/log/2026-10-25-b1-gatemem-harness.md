---
date: 2026-10-25
author: claude-agent
type: change
card: B1
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - fixtures/bench/gatemem/README.md
  - fixtures/bench/gatemem/manifest.json
  - fixtures/bench/gatemem/upstream-golden.json
  - packages/bench/src/gatemem/harness.ts
  - packages/bench/src/gatemem/agents.ts
  - packages/bench/src/gatemem/score.ts
  - packages/bench/test/gatemem/upstream.test.ts
  - "ENGRAM_OFFLINE=1 make bench BENCH=gatemem"
  - "pnpm exec vitest run packages/bench"
supersedes: none
---

**What.** Card B1 delivered the GateMem pipeline at pin a983828: 20 vendored checkpoints over four domains, a strict loader, allowlist stripping of hidden fields, the reset, ingest and query protocol, upstream's Long-Context reference agent on an injected ModelCall, predictions in GateMem's format and its rule-based scorer.

**Why.** Every GateMem arm of H1, H2 and H4 runs through this harness.

**Result.** On the fixture the port reproduces upstream Python's prompts, parsed outputs and rule-based scores exactly (`upstream.test.ts`). `make bench` makes 0 new model calls with ENGRAM_OFFLINE=1. The paper comparison, the acceptance, was not run: it needs paid models and the GPT-4o judge, and the pre-registration is backlogged.

**Consequence.** B1 stays open until that live run. The judge is not ported.
