---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/judge.test.ts
supersedes: none
---

**What.** The runner scored GateMem answers with the rule-based scorer only, though GateMem scores A, F and U with its judge and ADR 0031 said they go through it.

**Why.** Card B1's judge port was wired into the bench runner, not the condition runner.

**Result.** The runner now runs the judge pass, scripted in tests, live on the Responses API.

**Consequence.** Found by the independent review of PR #25 and fixed in its review fix pass.
