---
date: 2026-11-27
author: claude-agent
type: finding
card: H5P
chapter: limitations
pillar: distill
hypothesis: H5
evidence:
  - packages/bench/PINS.md
  - docs/research/preregistration.md
supersedes: none
---

**What.** The split counts and the two `split_tasks.json` hashes in the draft were read in card B11's tau2 checkout on 2026-11-25 and were not reread on 2026-11-27; only 12-character prefixes of the hashes are in the repository.

**Why.** No tau2 checkout is on this machine's `.engram/upstream/` today, and fetching one was outside this pass.

**Result.** Airline 30 train and 20 test of 50, retail 74 and 40 of 114, as the draft states; no script regenerates them yet. The draft now calls the hashes prefixes (review finding F11).

**Consequence.** The harness card's config records the full hashes and its test checks them at the pin.
