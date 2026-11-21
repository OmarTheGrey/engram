---
date: 2026-11-21
author: claude-agent
type: finding
card: L5
chapter: discussion
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-near-duplicate.json
  - fixtures/faults/duplicate.near-miss.json
  - fixtures/faults/orphan.flag.json
supersedes: docs/log/2026-11-21-l5-finding-case-copy.md
---

**What.** Supersedes the case-copy finding of this date: the one unlabelled finding is still the lower-cased copy in `duplicate.near-miss`, but the "fault fixture fact n" pairs are stopped by the cosine guard, not by the number veto.

**Why.** Review finding L5-1 counted the vetoes over the catalogue: the number veto fires 0 times there. In orphan.flag, for one, all 3 similar pairs end at the cosine.

**Result.** 1 unlabelled finding over the other lints' 14 fixtures.

**Consequence.** When arm P4 is registered, its audit should expect case-only restatements among the tier's findings.
