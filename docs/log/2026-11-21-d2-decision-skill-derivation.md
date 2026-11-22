---
date: 2026-11-21
author: claude-agent
type: decision
card: D2
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/skill.ts
  - packages/core/src/schema.ts
supersedes: none
---

**What.** A SKILL.md's frontmatter is derived from the item. `name` comes from the body's `# <title>` line, folded to ASCII, lowercased, hyphenated and cut to 64. `description` is the first paragraph after the title, whitespace collapsed, `---` cut to `--`, at most 1024 characters. `allowed-tools` is `tools` joined by spaces, and `metadata.engram-item` is the item id.

**Why.** `ProceduralContent` has only `body` and `tools`, and a schema change is card E2.8's alone (the brief).

**Result.** Frontmatter values are written double-quoted with JSON escapes only, so skills-ref's strictyaml and our parser read the same text. A body with no title or description is refused with `SkillFormatError`.

**Consequence.** If wrong, a distiller writes titles another way. The cost is a renamed skill, and no stored item changes.
