---
date: 2026-11-21
author: claude-agent
type: failure
card: B11
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/tau2/env.ts
supersedes: none
---

**What.** `uv sync --frozen --no-dev --python 3.12 --check`, the lock check the review asked for, failed on the working environment.

**Why.** uv counts the local editable project (tau2 itself) as outdated on every check (`~ tau2==1.0.1`), whatever the environment holds.

**Result.** The check passes `--no-install-project --inexact`, and reports "Audited 76 packages ... Would make no changes". tau2's own version is checked separately, together with the Python version (`3.12 1.0.1`).

**Consequence.** None.
