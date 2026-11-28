---
date: 2026-11-28
author: claude-agent
type: measurement
card: D4
chapter: results
pillar: distill
hypothesis: none
evidence:
  - research/results/h1-drift-fixture.json
  - research/configs/drift-fixture.json
  - research/configs/d4-drift-fixture.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/drift_fixture.py --config research/configs/drift-fixture.json --out research/results/h1-drift-fixture.json"
supersedes: none
---

**What.** A proof of concept on fixtures and a scripted model, not a hypothesis result: card D3's admitted procedure re-validated through `Plane.revalidate` after one held-out task changed, then on D3's pool.

**Why.** The lead asked for reproducible proofs of concept; this one shows drift detected and a procedure retired and restored by governed events, with zero new model calls.

**Result.** The environment hash changed, the success rate fell from 0.733 (11 of 15 trials at admission) to 0.533 (8 of 15), below medium's floor 0.7 after at least 10 trials: retired under `preset.medium.drift/drift/environment-changed`. On D3's pool it reached 0.733 and 4 of 5 again: restored. 508 calls from cassettes, 0 new. sha256 `579fa43dffc7ca6123e2b9812a6f22886c1581a70dfd59e561f20ee62e6abb71`, MANIFEST commit e22c4ad; filed under `h1-` for the results glob only.

**Consequence.** H5 registers admission only; this is an engineering check.
