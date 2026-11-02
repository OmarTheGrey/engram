---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
supersedes: none
---

**What.** ADR 0031 said an item is allowed exactly when C5's read would return it, which ignores the query match and the read limit.

**Why.** The claim was written for the filter alone.

**Result.** It now says the verdict equals C5's admission, and the read also depends on the shared matching and limit.

**Consequence.** Found by the second review of PR #25 and fixed in its round-2 fix pass.
