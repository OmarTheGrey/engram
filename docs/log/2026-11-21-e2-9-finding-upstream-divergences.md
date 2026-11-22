---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.9
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/policy/secrets-upstream.test.ts
supersedes: none
---

**What.** Six vectors of the three sources come out otherwise here, on purpose, each pinned with its reason.

**Why.** Porting the sources' tests (E2.9-6) shows where the copy diverged.

**Result.** Not found here: AWS's example key id (allowed); `AWS_SECRET_ACCESS_KEY=` twenty of one letter (a placeholder); a 26-character fine-grained token spelt in words (real ones have 82 characters); a cookie header (no cookie rule); `password=hunter2` (claude-mem's floor of eight characters); `token = "..."` mid-sentence (claude-mem counts bare `token` only in config positions). Held here, left alone by walrus: a 47-character build id with single capitals. Every other ported vector agrees.

**Consequence.** A cookie rule and a shorter password floor are choices for X14's attack set.
