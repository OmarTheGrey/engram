---
date: 2026-10-29
author: claude-agent
type: failure
card: B3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/test/b3.test.ts
supersedes: none
---

**What.** In the B3 review fix pass, the first try at adding the R5-6, R5-7 and R5-10 tests failed to run. The edit was a Python script inside a Bash heredoc, and the heredoc broke on the quotes in the embedded TypeScript.

**Why.** The shell treated the TypeScript template literals and quotes in the heredoc as its own syntax and reported an unterminated quote. The agent brief warns about this pitfall, and the agent ignored the warning once.

**Result.** The shell aborted and no file changed. The same edit went through as a script file and a TypeScript snippet file, written with the editor and run with `python -I`.

**Consequence.** No inline heredocs with code in them. Write code to a file first.
