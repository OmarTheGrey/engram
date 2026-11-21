---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
supersedes: none
---

**What.** The policy's mode is the most a match can do: under `block` a BLOCK-tier match denies and a REVIEW-tier match is held; under `review` every match is held.

**Why.** The card names two tiers and three modes and leaves open how they combine. A heuristic match (entropy, a hex run beside a word) is too uncertain to deny a write outright, and holding it keeps the writer and a reviewer in the loop.

**Result.** Tested in `secrets.test.ts` ("under block a REVIEW-tier match is held, not denied"). The rule id is the deciding match's guard.

**Consequence.** If wrong, a policy wanting heuristic matches denied has no setting for it; a third mode would be a schema change.
