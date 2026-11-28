---
date: 2026-11-28
author: claude-agent
type: measurement
card: E9.12
chapter: results
pillar: twin
hypothesis: none
evidence:
  - research/results/h1-consent-gate.json
  - research/configs/consent-gate.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/consent_gate.py --config research/configs/consent-gate.json --out research/results/h1-consent-gate.json"
supersedes: none
---

**What.** The consent gate counted on a fixture workload: a proof of concept on fixtures with no model, never a hypothesis result.

**Why.** The lead asked for proof-of-concept results where cheap.

**Result.** fixtures/workloads/e9-12-consent.json, 15 writes, by engram simulate. Twin profile: 15 allowed. With three opt-outs: 8 allowed, 7 refused under engram/write/consent (opt_outs[0] 3, [1] 3, [2] 1), 7 naming their opt-out, 0 repeating content; reads return 5 items, not 12. sha256 e3676e818dae1c0b85b74c121caf22a8de8454b81e3b2d4f484a09184d696bf1.

**Consequence.** The results register lists it as a proof of concept.
