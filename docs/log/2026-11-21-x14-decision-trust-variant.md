---
date: 2026-11-21
author: claude-agent
type: decision
card: X14
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/configs/redteam.json
  - packages/core/policies/medium-trust.yaml
supersedes: none
---

**What.** The trust setting is `medium+trust`, medium with both trust options on and nothing else, not the preset `medium-trust`.

**Why.** `medium-trust` also admits external content into person scope, so its contrast with medium would mix the floors with a changed source rule; P3 makes the same choice.

**Result.** Under `medium+trust` the unattested floor records an unattested write as external, which medium's person scope then refuses: every unattested attack and control is denied.

**Consequence.** Under `medium-trust` those writes would land at kind external instead. Cost if wrong: one more setting.
