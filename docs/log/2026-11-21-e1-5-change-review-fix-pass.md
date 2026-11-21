---
date: 2026-11-21
author: claude-agent
type: change
card: E1.5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - specs/commit.qnt
  - specs/README.md
  - Makefile
  - make verify-spec
supersedes: none
---

**What.** The fix pass for the review of card E1.5 (findings E1.5-1 to E1.5-9).

**Why.** The review confirmed the transitions, the ghost `orig` and the broken trace, and found four important issues, two of them gaps in the code.

**Result.** Store records carry a non-content field and adoption models `asHeld`; property 4 is restated as AGENTS.md invariant 6; property 3 reads ghost marks; the broken gates require `erasureHolds` and `noWriteWhileErasing`, with fresh outputs; the module knownGapThreeOffboardings pins the put-back leak; two backlog rows. `make verify-spec` exited 0 in 4 min 25 s: 7, 2 and 1 scenario tests passing, seeds 1 to 3 clean, the broken model refuted on all three properties by simulation and on two by Apalache, which passed the good model to depth 4 in 94 s.

**Consequence.** specs/README.md states the bounds, the vacuous Apalache clauses, the give-up paths and the retire-versus-removal difference.
