---
date: 2026-11-19
author: claude-agent
type: finding
card: L3
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/lint/model.ts
  - docs/decisions/0008-two-tier-lints.md
supersedes: none
---

**What.** An item's own content can steer the model lints' verdict, for example a claim that says it is stated verbatim in its source.

**Why.** Review L3-6. The inputs are sent as one JSON object, so content cannot break a delimiter, but its words still reach the model.

**Result.** The only defence is the prompt's line that the inputs are data, not instructions; no test can show a live model heeds it, and the scripted tests do not try.

**Consequence.** H3's model tier is open to the poisoning it is meant to catch; the limitations chapter says so, and a seeded steering fault in L2's set would measure it.
