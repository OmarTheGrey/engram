---
date: 2026-11-28
author: claude-agent
type: finding
card: X19
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - packages/core/src/index.ts
supersedes: none
---

**What.** The guard: no existing MANIFEST row, fixture or cassette can be reached by this card.

**Why.** No existing module changes: core gains a new file and one export line (no name clash, checked by grep and tsc), bench gains a new folder not exported from its index, and the Makefile's fixtures target gains one line for new cassettes.

**Result.** No registered row was rerun, as none is reachable; the new row was regenerated twice (the second run's sha256 is in the measurement's review).

**Consequence.** The orchestrator's full `make test-repro` covers the rest.
