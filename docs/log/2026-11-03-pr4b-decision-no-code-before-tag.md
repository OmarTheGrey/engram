---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-table.json
  - research/results/h1-refusal-leaks.json
  - docs/log/2026-11-03-pr4a-r1-decision-gatemem-sets.md
supersedes: docs/log/2026-11-03-pr4b-decision-code-after-answers.md
---

**What.** Items 9 and 10 need no code before the tag: the primary GateMem set and the refusal-leak sensitivity list are entries of `research/configs/h1-table.json` already.

**Why.** Part A's review fix pass built both after the v1 draft: `h1-sessions/2` carries each GateMem session's checkpoint kind, `gatemem_primary` names the primary set, and `research/results/h1-refusal-leaks.json` lists the 41 checkpoints (29 access control, 12 forgetting).

**Result.** If the lead accepts items 9 and 10, nothing changes; if not, one config line each. The superseded entry left both as code for a PR before the tag.

**Consequence.** The plan's section 7 drops that step, and the PR that writes the answers into v1 is the only one before the tag.
