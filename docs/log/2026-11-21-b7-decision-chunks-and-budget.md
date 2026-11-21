---
date: 2026-11-21
author: claude-agent
type: decision
card: B7
chapter: design
pillar: research
hypothesis: H2
evidence:
  - packages/bench/scripts/merit-shim.py
supersedes: none
---

**What.** A write is the transcript in 600-character chunks, each one episodic item at confidence 0.5; a read joins the ranked items with MERIT's separator while they fit `budget_chars` (4,000 by default). C5's read rules are not rendered into the prompt.

**Why.** Whole transcripts grow past the budget by the third episode and would return nothing; 600 is MERIT's own retrieval chunk size. MERIT, not a tool, builds the prompt.

**Result.** C2 and C5 send identical memory blocks when the plane admits everything (seam test).

**Consequence.** Card X7 may render the plane's tag; that moves every C5 key.
