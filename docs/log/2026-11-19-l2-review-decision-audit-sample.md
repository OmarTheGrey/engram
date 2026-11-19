---
date: 2026-11-19
author: claude-agent
type: decision
card: L2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - research/configs/h3-fault-set.json
  - research/scripts/h3_fault_set.py
supersedes: none
---

**What.** The audit sample of base-item findings draws 50 per lint (all of a lint with fewer), in an order seeded by the config (`audit.seed` 20261120), written under `.engram/faults/h3-fault-set-audit/`: `draw.json`, one context file per finding, and a sheet with empty `real_or_false` and `comment` columns.

**Why.** Review finding L2-1 asks for precision on natural memory. 50 per lint mirrors the label audit's 50 items per benchmark (ADR 0015), and gives a 95 percent interval of about plus or minus 14 points on a share near one half. The sheet is written only when absent, so a filled one is never overwritten; `draw.json` is rewritten each run and its hash committed.

**Result.** The result's `audit` names the counts and the draw's hash.

**Consequence.** A member fills the sheet; L4 reads it. The model tier's base findings are L4's to sample the same way.
