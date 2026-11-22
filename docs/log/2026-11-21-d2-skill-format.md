---
date: 2026-11-21
author: claude-agent
type: change
card: D2
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/skill.ts
  - packages/core/test/unit/distill/skill.test.ts
  - packages/core/test/unit/distill/skill-spec/expected.json
  - "make test-one T=packages/core/test/unit/distill/skill.test.ts"
supersedes: none
---

**What.** Core gains `toSkillMd`, `parseSkillMd`, `validateSkillMd` and `skillContent`, pure functions between a procedural item and the Agent Skills SKILL.md format.

**Why.** Card D2 step 1: an admitted procedure should load in Claude Code and pi without a converter.

**Result.** `validateSkillMd` ports skills-ref's `validate_metadata` rules and messages. On all 29 cases it gives the errors the specification's own validator gave, recorded offline in `expected.json`. All four sample items round-trip body and tools exactly, and their SKILL.md passes the validator with no error. 34 tests pass. Removing the consecutive-hyphen rule and the `---` shortening fails 4 of them.

**Consequence.** Card D3 can export an admitted candidate's SKILL.md with `toSkillMd`.
