---
date: 2026-11-21
author: claude-agent
type: finding
card: D2
chapter: related-work
pillar: distill
hypothesis: none
evidence:
  - packages/core/test/unit/distill/skill-spec/expected.json
  - packages/core/test/unit/distill/skill-spec/cases.json
supersedes: none
---

**What.** The specification's validator is looser than its text in three ways. It accepts Unicode lowercase letters in a name (`café` passes), where the text says a-z and 0-9. It splits a file at the first two `---` anywhere, not on lines. It does not check `allowed-tools`.

**Why.** Card D2 validates against the specification, not against one harness.

**Result.** Case `unicode-lowercase-name` passes with no error. `toSkillMd` writes ASCII names only and never puts `---` in its frontmatter, so it satisfies both readings.

**Consequence.** A stricter harness could refuse a hand-written skill that the validator accepts. Ours are not such skills.
