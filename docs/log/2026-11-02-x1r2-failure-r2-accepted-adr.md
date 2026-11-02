---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/decisions/0009-retrieval-explanations.md
supersedes: none
---

**What.** The first fix pass amended ADR 0009, an accepted decision, as if decided, without saying the change was a proposal or updating the architecture's read path.

**Why.** The review fix pass treated the ADR like a PR's own draft.

**Result.** The amendment is now a proposal for the lead, and `docs/architecture.md` matches the code.

**Consequence.** Found by the second review of PR #25 and fixed in its round-2 fix pass.
