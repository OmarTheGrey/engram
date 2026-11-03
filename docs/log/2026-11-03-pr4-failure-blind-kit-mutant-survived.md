---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/research/h1-sessions.test.ts
  - packages/runner/src/research/h1-sessions.ts
supersedes: none
---

**What.** One of three mutants of the blind kit survived: with the check of a reply's hash against its key entry switched off, every test passed.

**Why.** The only test of a wrong hash changed the hash alone, and the separate check that a reply's text matches its own hash caught it first. No test crossed two replies, text and hash together, under their ids.

**Result.** A test now crosses two replies under their ids. The mutant is killed, and so are the other two (the template left in the sessions' order, the key not matched against the run), all with the work committed first and the file restored by copy.

**Consequence.** When two checks guard one property, each needs a test that only it catches.
