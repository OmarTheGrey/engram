---
date: 2026-11-20
author: claude-agent
type: decision
card: RV8
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/runner/src/research/longmemeval-clock.ts
  - packages/runner/scripts/frontier-axes.ts
supersedes: none
---

**What.** `clockRow` in the runner gained a sibling, `clockRowFor`, that takes named policies; `clockRow` now calls it with the presets it loads.

**Why.** The frontier needs B5's write phase and read under policy variants, and a copy of that logic in the entry point would be a second implementation.

**Result.** The ttl result's code path is unchanged (`clockRow` gives the same rows); the frontier entry point validates each variant with core's `parsePolicy` and passes it on.

**Consequence.** One small change in `packages/runner/src/research/`, outside `research/`; RV6 works elsewhere in the runner.
