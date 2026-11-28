---
date: 2026-11-28
author: claude-agent
type: change
card: E2.18
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/reproduce.py
  - research/tests/test_research_scripts.py
  - AGENTS.md
  - "uv run pytest research/tests/test_research_scripts.py -k \"reproduce or skipped\""
supersedes: none
---

**What.** make test-repro reports a row whose script exits 3, a tool missing, as SKIP with the script's reason, counted apart, never as ok.

**Why.** Review finding 1: the Cedar properties row needs cargo and cvc5, so test-repro failed for anyone without them, and the AGENTS.md line promised only data fetches.

**Result.** reproduce.py prints `test-repro: SKIP <file>: <reason>` and `<n> of <m> results reproduce; <k> skipped for a missing tool, not checked`; the exit status is 1 only on a real problem. Three tests: a skipped row beside a reproducing one passes; a skipped row beside a mismatch fails; a skipped row whose committed file differs from its hash fails. The test-repro line in AGENTS.md and CLAUDE.md now says this row needs cargo and fetches the pinned cvc5 executable.

**Consequence.** No other script exits 3; a future one that lacks a tool can use the same status.
