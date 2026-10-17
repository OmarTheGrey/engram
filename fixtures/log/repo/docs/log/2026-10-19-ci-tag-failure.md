---
date: 2026-10-19
author: fixture
type: failure
card: S0.1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - "gh run view 1 --log-failed"
supersedes: none
---

**What.** CI failed because an action tag did not exist.

**Why.** The workflow assumed every action publishes a floating major tag.

**Result.** The run failed before any step.

**Consequence.** Actions are pinned to tags that exist.
