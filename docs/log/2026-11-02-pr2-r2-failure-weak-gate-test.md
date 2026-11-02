---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H4
evidence:
  - research/tests/test_research_scripts.py
supersedes: none
---

**What.** The first test of the power script's exact-level gate passed even with the gate's exact half removed at its call site.

**Why.** It stubbed the exact level to fail and expected no size, but its ladder stopped before the power target was reachable, so no size was reported either way.

**Result.** The test now stubs power to always reach the target and simulated levels to always be clean, and runs both an exact level that holds and one that fails; the call-site mutant is killed.

**Consequence.** None.
