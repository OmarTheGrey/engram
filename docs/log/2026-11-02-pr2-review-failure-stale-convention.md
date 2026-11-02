---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - docs/conventions/testing.md
supersedes: none
---

**What.** Review finding P2-11: `docs/conventions/testing.md` still described layer 8 as `research/tests/test_reproduce.py`, cache-only and nightly.

**Why.** The PR made `make test-repro` real (plan decision 10) but changed only AGENTS.md and CLAUDE.md, leaving the convention to describe a test that does not exist.

**Result.** Layer 8's row, the CI sentence and the reproduce paragraph now describe `research/scripts/reproduce.py` (decision entry of the same day).

**Consequence.** None.
