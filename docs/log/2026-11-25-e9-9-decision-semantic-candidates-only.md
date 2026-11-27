---
date: 2026-11-25
author: claude-agent
type: decision
card: E9.9
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - research/configs/crosswalk.json
supersedes: none
---

**What.** Acceptance covers semantic candidates only, in place; episodic and procedural candidates are left out.

**Why.** An episodic item's promotion is a class change to semantic, which crosswalk claim C46 holds to k confirmations or a reviewer who does not own it; a procedural candidate needs its replay record, which no review replaces.

**Result.** C46 stays true and `h1-crosswalk.json` is byte for byte the same. Cost if wrong: an imported or held episodic note still needs a second member, or a restatement.

**Consequence.** The episodic case is a question for the lead, not a backlog row yet.
