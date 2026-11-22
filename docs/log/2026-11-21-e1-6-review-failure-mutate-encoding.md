---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/verify.ts
supersedes: none
---

**What.** The first two runs of the mutant script stopped at its first print.

**Why.** Python on this machine writes stdout in cp1252, vitest's output carries characters it cannot encode, and python -I ignores PYTHONIOENCODING.

**Result.** The script reconfigures stdout to UTF-8; the third run completed. Each mutant had been restored by git checkout, so the tree stayed clean.

**Consequence.** Scripts here set their output encoding themselves.
