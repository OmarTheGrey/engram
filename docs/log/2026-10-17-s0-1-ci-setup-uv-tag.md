---
date: 2026-10-17
author: omar
type: failure
card: S0.1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - .github/workflows/ci.yml
  - "gh run view 39048041089 --log-failed"
supersedes: none
---

**What.** The first CI run of S0.1 failed before any step ran because `astral-sh/setup-uv@v10` does not resolve.

**Why.** The workflow used floating major tags for every action. `actions/checkout`, `actions/setup-node` and `pnpm/action-setup` publish them; `astral-sh/setup-uv` stopped at `v7`, and its current release is only tagged `v10.3.0`.

**Result.** Run 39048041089 failed in "Set up job" with "unable to find version `v10`". The workflow now pins `astral-sh/setup-uv@v10.3.0`.

**Consequence.** Before adding an action, check that the tag exists (`gh api repos/<owner>/<repo>/git/matching-refs/tags/v`).
