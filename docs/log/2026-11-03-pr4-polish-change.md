---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_h1_secondary.py
  - research/tests/test_h1_pipeline.py
  - research/scripts/label_audit_agreement.py
  - research/tests/test_label_audit.py
  - Makefile
  - packages/runner/scripts/h1-sessions.ts
supersedes: none
---

**What.** The final verifier's code items: F-1 and F-2 tests; `decides` and no decision block in the gate-by-action table (F-6); no template written by the gate-by-action run (F-8); the converter's comments say the readers are "not shown the condition", as v1 does.

**Why.** The verifier found PR 4 ready and left these minor items.

**Result.** Five mutants are killed. Item 6, REPLAY's refusal under `ENGRAM_OFFLINE=1` beginning "live run refused", is left as it is: the prefix comes from the shared `LiveRunRefused`, which `replayConfig` also throws through `liveCassettes`, so rewording the replay path needs more than one line.

**Consequence.** No result's code changed.
