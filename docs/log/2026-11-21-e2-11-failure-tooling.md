---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/counterexamples/trust.test.ts
supersedes: none
---

**What.** Two Bash heredocs holding quotes broke, and the session was cut off twice by API timeouts.

**Why.** Known pitfalls on this machine.

**Result.** The edits were rewritten as Python files run with `python -I`; work resumed from the last commit each time with nothing lost.

**Consequence.** Each step is committed as soon as it is done.
