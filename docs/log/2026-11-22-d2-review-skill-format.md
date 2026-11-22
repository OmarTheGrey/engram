---
date: 2026-11-22
author: claude-agent
type: change
card: D2
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/skill.ts
  - packages/core/test/unit/distill/skill-spec/expected.json
  - "make test-one T=packages/core/test/unit/distill/skill.test.ts"
supersedes: docs/log/2026-11-21-d2-skill-format.md
---

**What.** `validateSkillMd` and `parseSkillMd` now refuse a tab after the colon, as skills-ref does. Their header states that they read a stricter YAML subset than skills-ref. `expected.json` records each text's sha256.

**Why.** Review finding D2-7.

**Result.** There are 37 cases: the tab case agrees with the validator, and eight `subset` cases (multi-line plain, `>`, `|`, a YAML escape, `--- ` with a trailing space, `name : x`, `allowed-tools` as a list) are accepted by the validator and refused by ours. 43 tests pass. A stale `expected.json` after `ENGRAM_UPDATE_FIXTURES=1` fails the hash test, and so does a regex that admits tabs.

**Consequence.** None.
