---
date: 2026-11-26
author: claude-agent
type: failure
card: R6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - "git show 1468a2b9 -- research/configs/h1-gatemem.json"
  - research/configs/openrouter-endpoints.json
supersedes: none
---

**What.** The first pin of M1 (commit `1468a2b9`) took DeepSeek's own endpoint, tag `deepseek`, by the rule's first branch read literally, although that endpoint does not honour `seed`.

**Why.** The rule names the maker's endpoint first and puts the `seed` condition only on its second branch; the conflict with AGENTS.md rule 6 was written down as a note instead of being settled.

**Result.** The independent review raised it (finding R6-3), and the coordinator decided that a maker's endpoint without `seed` does not qualify. Commit `7ca9cd60` moved every M1 pin to `wafer/us`, and the test now checks that every pinned endpoint honours `seed`.

**Consequence.** No run used the first pin; nothing to undo outside this branch.
