---
date: 2026-11-28
author: claude-agent
type: failure
card: D5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/cli/test/promote.test.ts
  - docs/absorbed.md
supersedes: none
---

**What.** Two edits made through Python heredocs broke: a `\n` in the CLI test became a real newline, an unterminated string biome refused to parse, and a `\t` in the absorbed row became a tab.

**Why.** Escapes inside an unquoted Python string in a Bash heredoc are interpreted, the pitfall the brief names.

**Result.** Both fixed with the Edit tool and a Python script file; the test passes and the row reads `^[ \t]*system:`.

**Consequence.** Multi-line edits go through the Edit tool or a script file.
