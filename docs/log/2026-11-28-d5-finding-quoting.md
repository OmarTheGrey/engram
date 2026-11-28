---
date: 2026-11-28
author: claude-agent
type: finding
card: D5
chapter: limitations
pillar: distill
hypothesis: none
evidence:
  - research/results/h5-procedure-scan.json
  - fixtures/faults/procedural/corpus.json
supersedes: none
---

**What.** A pattern scan cannot tell quoting from intent: "Never run rm -rf / on the host", a lesson quoting "ignore all previous instructions", and rustup's official `curl ... | sh` installer are all held.

**Why.** The corpus keeps them as hard negatives so the false-hold rate is honest (2603.16572 argues scanners over-label).

**Result.** They are the three false holds of `h5-procedure-scan.json`; a release with a reason is the way through, as the card intends.

**Consequence.** H5's preregistration, if it ever arms the scan, should report precision on labelled data, not recall alone, as the literature note for 2602.06547 already says.
