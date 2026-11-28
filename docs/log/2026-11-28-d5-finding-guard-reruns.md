---
date: 2026-11-28
author: claude-agent
type: finding
card: D5
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/scripts/reproduce.py
  - fixtures/faults/procedural/corpus.json
supersedes: none
---

**What.** Every MANIFEST row the change could reach was rerun with `reproduce.rerun_row`, and the fault catalogue regenerated into a temporary folder.

**Why.** The guard: no registered result, fixture or cassette moves. The change reaches Plane.promote, the policy readers, exportCedar and faults.ts.

**Result.** Reproduced byte for byte: h1-gate-mutation-audit, h1-quint-trace-replay, h1-leakage, h1-redteam, h1-crosswalk, h1-injection-screen, h1-secret-guard, h3-near-duplicate, h3-fault-set, h3-lint-floor, h5-procedure-scan. h2-cedar-properties skipped (cvc5 missing); exportCedar's text for every preset is unchanged, pinned by `procedural.test.ts`. Every committed file under `fixtures/faults` regenerates identically. No cassette is read. GateMem rows admit no procedures.

**Consequence.** Nothing registered moved.
