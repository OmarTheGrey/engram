---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/log/2026-11-03-pr4b-finding-store-time-and-requests.md
  - research/configs/h1-gatemem.json
supersedes: none
---

**What.** Recommended, for the lead's decision: H1 runs on Mem0, and the three H1 configs name it (decision sheet item 2).

**Why.** PR 3 left `fake` as a placeholder (`docs/log/2026-11-02-x1-h1-store-placeholder.md`); H4 compares files, Mem0 and Letta, and the fake store is the conformance suite's test double.

**Result.** The model's requests are byte-identical on fake, Mem0 and Letta, replays take as long on Mem0 as on fake, and Letta took about eleven times as long (`docs/log/2026-11-03-pr4b-finding-store-time-and-requests.md`). Both arms count on Mem0 with no call.

**Consequence.** If the lead chooses another store, four lines change: the three configs and the count test.
