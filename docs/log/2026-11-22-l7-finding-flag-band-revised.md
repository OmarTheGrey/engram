---
date: 2026-11-22
author: claude-agent
type: finding
card: L7
chapter: discussion
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-lint-nli.json
  - "make h3-lint-nli"
supersedes: docs/log/2026-11-22-l7-finding-flag-band-empty.md
---

**What.** Revised the flag-band finding: forward-only scoring would not have given a useful flag band on card L4's fixture.

**Why.** The earlier entry implied a forward-only upper of 0.9 would flag the four faults with no model call, leaving out what else it flags (review L7-2).

**Result.** Of 113 pairs, 87 score 0.9 or more by both directions and 81 forward only (`score_counts`). A forward-only upper of 0.9 flags 81 pairs on 28 items: 4 contradiction faults, 4 contradiction near-misses, 14 items with other labels and 6 with none (`forward_only_flags`).

**Consequence.** The empty flag band is not an artefact of the direction rule. The choice is the lead's, item 66. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
