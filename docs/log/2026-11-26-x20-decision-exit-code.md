---
date: 2026-11-26
author: claude-agent
type: decision
card: X20
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/scripts/run.ts
  - packages/runner/test/answer-refusal.test.ts
supersedes: none
---

**What.** A stopping status and the refusal backstop exit `make run` with code 1, the code of any thrown error, and no code of their own.

**Why.** The card leaves open whether the stop exits with its own code like the ceiling's 3. The ceiling is a planned stop that writes a summary of the completed subset; these stops are failures the operator must read, with no summary, the same handling as a transient outage that outlasted the session retry. The message names the status and says to rerun with RESUME=1. run.ts and scripts/run.ts are unchanged.

**Result.** The journal keeps every finished row; RESUME=1 runs the stopped session (tested for each status).

**Consequence.** A wrapper that must tell a key stop from a crash reads the message; adding a code later changes no result.
