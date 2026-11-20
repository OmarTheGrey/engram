---
date: 2026-11-20
author: claude-agent
type: decision
card: RV8
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/configs/label-audit.json
  - research/configs/label-audit-longmemeval.json
supersedes: none
---

**What.** Both audit configs set `on_stop` to `pause` and `reject_quorum` to 2.

**Why.** The quorum of 2 is lead-decisions item 5's recommended answer and the pre-registration's current rule. For item 6 the recommended answer is (a), drop and proceed, but the pre-registration's text says the runs wait for an amendment, and that text binds until the lead answers.

**Result.** `pause` is the registered response; `drop` gives item 6a and reports how many items are kept. Each is one config value, tested both ways.

**Consequence.** If the lead answers 6a, set `on_stop` to `drop` in both configs; no code changes.
