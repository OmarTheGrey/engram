---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/log/2026-11-02-pr2-review-failure-excluded-pairing.md
  - research/analysis/bootstrap.py
supersedes: none
---

**What.** Recommended, for the lead's decision: an (item, seed) excluded (no judge verdict; FILTERED, EXCLUDED, MALFORMED, or unread UNREAD) or missing under either condition is dropped from both, an item with no seed left leaves the contrast, and each contrast reports how many it dropped (decision sheet item 13b).

**Why.** v0.2 pairs on item, model and seed but does not say how a session that cannot be scored enters.

**Result.** PR 2's review replaced its first rule, which averaged each condition over its own seeds and broke the pairing (`docs/log/2026-11-02-pr2-review-failure-excluded-pairing.md`); `paired_item_differences` implements the rule.

**Consequence.** If exclusions depend on the condition, dropping biases the contrast, and the reported counts show it.
