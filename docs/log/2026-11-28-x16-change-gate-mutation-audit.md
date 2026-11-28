---
date: 2026-11-28
author: claude-agent
type: change
card: X16
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - research/scripts/gate_mutation_audit.py
  - research/configs/gate-mutation-audit.json
  - fixtures/mutants/
  - research/tests/test_gate_mutation_audit.py
  - "uv run pytest research/tests/test_gate_mutation_audit.py"
supersedes: none
---

**What.** Card X16 adds the gate mutation audit: 34 frozen mutants in `fixtures/mutants/`, each one exact substitution in `packages/core/src` and the invariant whose test must kill it, and a script that runs each in a scratch copy and counts killed and surviving mutants per invariant.

**Why.** Several cards checked by hand that a test bites; a regenerated number per invariant is stronger Part I evidence than a review note.

**Result.** The mutants cover the write gate, the read filter, retention, promotion, adoption, offboarding, the trust floors, replay and the log's chain, two to eight per invariant test (`I1` to `I9`, and `I1H`, the two-handle walk). The guards are ported from plur's `bite.py` (Apache-2.0, port, row in `docs/absorbed.md`); Nestor's mutation guard (Apache-2.0, d94a5c79) is an idea only. Pytest checks the guards on planted reports and a fake runner.

**Consequence.** `make test-repro` reruns the audit through its MANIFEST row.
