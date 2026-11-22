---
date: 2026-11-21
author: claude-agent
type: decision
card: X14
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/configs/redteam.json
supersedes: none
---

**What.** `medium+all` turns every guard on at its strongest: secrets and pii at block, the size limit, the screen at hardened, both trust options.

**Why.** P1 says "all of them on" and names no profile; the strongest of each is the upper bound of what the guards stop together.

**Result.** Write route, tool source: survival 0.737 and 4 of 448 controls held (`research/results/h1-redteam.json`).

**Consequence.** A default-screen combination is one config line away. Cost if wrong: one setting.
