---
date: 2026-11-19
author: claude-agent
type: failure
card: RV2
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/log/2026-11-19-rv2-decision-every-unread-read.md
supersedes: none
---

**What.** Review finding RV2-5: my decision to refuse readings that leave an UNREAD session unread did not say that this is stricter than upstream.

**Why.** I cited item 14 and not MEM-INV-Bench's own `code/score.py`. That script scores with UNREAD rows left out and never refuses a partial reading.

**Result.** The decision is restated with the comparison (`docs/log/2026-11-19-rv2-review-decision-every-unread-read.md`).

**Consequence.** The thesis can say where H1's scoring departs from upstream's.
