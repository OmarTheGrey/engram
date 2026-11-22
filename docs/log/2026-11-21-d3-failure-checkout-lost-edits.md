---
date: 2026-11-21
author: claude-agent
type: failure
card: D3
chapter: implementation
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/policy/promotion.ts
supersedes: none
---

**What.** A mutation check restored `promotion.ts` with `git checkout`, which discarded its uncommitted D3 edits along with the mutation.

**Why.** The file had been edited but not committed when the mutation was made.

**Result.** The edits were made again and the core work committed before any later mutation check, each then restored with `git checkout` from a clean file.

**Consequence.** Commit before mutating.
