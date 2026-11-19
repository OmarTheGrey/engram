---
date: 2026-11-19
author: claude-orchestrator
type: decision
card: none
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - docs/tasks/key-free-work-plan.md
supersedes: none
---

**What.** The plan gained a second wave of three PRs, followed by a review of the whole repository. The three PRs are L4 (lint precision and recall), E9.5's kit (the twin dogfood, ready to run) and B6's engineering half (LongMemEval's enforced baseline).

**Why.** The lead asked for the next three PRs after wave 1, then a comprehensive review with its findings on functionality and design gaps addressed. L4 and E9.5 close Gate D's lint and dogfood criteria. B6 gives H2's primary test its baseline; L2 also found that medium's ttl hides LongMemEval turns at read time, which B6 measures.

**Result.** Sections 7 and 8 of `docs/tasks/key-free-work-plan.md`.

**Consequence.** Each wave-2 PR starts when its dependency merges; the review runs after wave 2.
