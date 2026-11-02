---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/gate-b-plan.md
  - docs/tasks/B3.md
  - docs/decisions/0009-retrieval-explanations.md
supersedes: none
---

**What.** The Gate B record (section 7 of the Gate B plan) and card B3 carry a dated note: B3, RN1 and B4 run C5 through the runner's core-pipeline plane, so Gate B's GateMem-through-the-plane evidence rests on ADR 0009's proposed amendment.

**Why.** PR #25 changed what C5 reads for every card that runs it, and B3's and RN1's cassettes were recorded again; a reader of the gate record could not tell (review round 3, V-8).

**Result.** The note says what is unchanged (the read filter, every write event and denial), what changed (which admitted items a read returns and their order), and what happens if the lead rejects the amendment: C5 returns to the accepted read and `make fixtures` records B3, RN1 and B4 again.

**Consequence.** The lead decides the amendment knowing it touches Gate B's evidence.
