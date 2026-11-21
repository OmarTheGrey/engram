---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.7
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - "make test-one T=packages/core/test/counterexamples/trust.test.ts"
  - packages/core/test/counterexamples/trust.test.ts
  - packages/core/src/policy/retention.ts
  - packages/core/src/policy/evaluate.ts
  - packages/pi-extension/src/extension.ts
  - packages/mcp/src/server.ts
  - packages/runner/src/gatemem-probe.ts
  - packages/bench/src/faults/generate.ts
  - research/results/h2-frontier-axes.json
  - packages/core/policies/strict.yaml
  - "uv run python -I -c "import json; d=json.load(open('.engram/upstream/longmemeval/data/longmemeval_s_cleaned.json', encoding='utf8')); print(max(sum(len(s) for s in q['haystack_sessions']) for q in d))""
supersedes: none
---

**What.** GH-38 is confirmed: a non-owner co-member less trusted than an active item rewrites, retires or budget-evicts it in all 63 such cells.

**Why.** ADR 0040 acts only on confirmed cells.

**Result.** Card RV7's owner rule denies a non-owner's rewrite or retire of a grant-carrying item; the grant rule, any model rewrite of one; eviction consults neither. The owner's id with a lower source rewrites freely. Adoption of a hand-edited user item records `import`, which ADR 0040's user-only exemption would deny. The pi and MCP agents write only new ids (`extension.ts:156`, `server.ts:144`): they can evict, never rewrite or retire.

**Consequence.** No registered number moves: the fix is opt-in; GateMem's C5 ingestion fails on any eviction (`gatemem-probe.ts:353`); LongMemEval's S split has at most 616 turns a question, under strict's budget of 1,000; H3's faults rewrite at the turn's own source (`generate.ts:582`). Only the descriptive budget variants of `h2-frontier-axes.json` evict across kinds.
