---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.5
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** The printable rule ids are core's `engram/` ids, listed in `ENGRAM_RULES`, and those a policy named `profile.<name>` or `preset.<name>` builds from its own fields.

**Why.** E95-12 asked for the twin profile's own fixed list; deriving it from the policy keeps the list exact for the twin and the presets, and a drift test keeps the `engram/` list in step with core.

**Result.** Any other id counts as `other`.

**Consequence.** A Knowledge dogfood can use the same report with `--policy`.
