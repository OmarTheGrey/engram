---
date: 2026-11-21
author: claude-agent
type: change
card: L5
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - research/pyproject.toml
  - uv.lock
  - docs/deps.md
supersedes: none
---

**What.** datasketch 2.0.0 (MIT, released 2026-07-05) joins research/pyproject.toml with a docs/deps.md row.

**Why.** Card L5 needs an oracle MinHash in research code only; numpy and scipy, its dependencies, were already pinned.

**Result.** `uv lock` added one package; no package under packages/ imports it.

**Consequence.** Nothing else.
