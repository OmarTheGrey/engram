---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.5
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - Makefile
  - specs/README.md
supersedes: none
---

**What.** Apalache's broken-variant gate requires `noWriteWhileErasing` and `noStaleAppend` to be refuted within depth 4, not `erasureHolds`; the simulation gate requires all three.

**Why.** Any erasure takes at least 6 steps, so at depth 4 `erasureHolds` holds vacuously and cannot be refuted; a run to depth 6 did not finish in ten minutes.

**Result.** The README says Apalache checks `erasureHolds` and the erased-id clause vacuously at depth 4, and the simulation is the evidence for them.

**Consequence.** A faster machine could raise SPEC_DEPTH to 6 and add `erasureHolds` to SPEC_BROKEN_BMC.
