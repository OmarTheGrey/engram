---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.5
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - docs/dogfood.md
  - packages/pi-package/profiles/twin.yaml
supersedes: none
---

**What.** The review of the twin profile recommends accepting every proposed value unchanged for the dogfood.

**Why.** Each value matches ADR 0021's split or the medium preset; none blocks two weeks of one member's use, though most retention, promotion and role rules are not exercised by it.

**Result.** The table in `docs/dogfood.md`, "The twin profile's values", gives the reason per value and what the dogfood does not exercise.

**Consequence.** The lead accepts or changes them; a change is a profile PR.
