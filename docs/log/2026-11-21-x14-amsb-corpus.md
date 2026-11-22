---
date: 2026-11-21
author: claude-agent
type: change
card: X14
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - fixtures/amsb/scenarios.json
  - packages/bench/scripts/vendor-amsb.py
  - packages/bench/src/amsb/load.ts
  - "make test-one T=packages/bench/test/redteam/amsb.test.ts"
supersedes: none
---

**What.** Card X14 copied OWASP Agent Memory Guard's AMSB scenario corpus as data into `fixtures/amsb/scenarios.json`, with a loader in `packages/bench/src/amsb/`.

**Why.** The red-team harness needs an attack suite the guard cards did not write for themselves, with AMSB's own canaries and severity grades.

**Result.** At commit `b052787cc342` (Apache-2.0, LICENSE.md read there, Copyright 2026 OWASP Foundation) the corpus holds 21 scenarios: 15 attacks (prompt injection 4, sensitive data 3, protected key 3, memory persistence 4, size anomaly 1) and 6 benign, as card R2 counted. `vendor-amsb.py` reads `scenarios.py` with `ast` and never executes it; `make fixtures` reruns it byte for byte. The row in `docs/absorbed.md` and the NOTICE entry are added; the amsb test (5 tests) passes.

**Consequence.** The harness plants these 21 scenarios beside the payload sets and the controls.
