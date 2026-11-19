---
date: 2026-11-19
author: omar
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/configs/label-audit.json
  - docs/research/label-audit.md
supersedes: docs/log/2026-11-03-pr4b-fr-decision-label-audit.md
---

**What.** The lead changed decision sheet item 16: three members audit H1's labels, Omar, Mohamad and Shady, in the two phases the sheet recommends, and an item is rejected when at least two of the three reject it.

**Why.** The sheet asked him to name the members; he named three rather than two.

**Result.** Item 16's answer line records the change. `research/configs/label-audit.json` names `omar`, `mohamad` and `shady`, and the kit takes three members (`docs/log/2026-11-19-label-audit-three-members.md`). `stop_share` stays 0.10, with the same counts: 6 or more of GateMem's 50, 4 or more of MEM-INV-Bench's 38. v1's label-audit sentence and section 7's step 2 say so.

**Consequence.** The three members run the audit before the tag; how the two-of-three rule and the kappas are computed waits for the lead's confirmation (`docs/log/2026-11-19-orch-decision-two-of-three.md`).
