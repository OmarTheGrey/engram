---
date: 2026-11-19
author: claude-agent
type: failure
card: RV1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - scripts/test/no-docker.test.ts
  - "pnpm exec vitest run scripts/test/no-docker.test.ts"
supersedes: none
---

**What.** The no-Docker gate failed on the Makefile after this card's edit, though no container command was added.

**Why.** The edit was made by a Python script writing in text mode on Windows, which turned every line ending of the Makefile, AGENTS.md and CLAUDE.md into CRLF. The gate strips `#` comments with a JavaScript pattern whose `.` stops at a carriage return, so the help text of `test-e2e` ("no Docker") was no longer stripped and matched as a container command.

**Result.** The three files were converted back to LF; no other changed file had a carriage return. The gate passes again in the final `make test`.

**Consequence.** Edit scripts write with `newline="\n"`, or the Edit tool is used; a CRLF in a changed file is checked before committing.
