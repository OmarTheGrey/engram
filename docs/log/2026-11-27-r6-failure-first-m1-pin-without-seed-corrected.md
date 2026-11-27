---
date: 2026-11-27
author: claude-agent
type: failure
card: R6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - "git show 1468a2b9 -- research/configs/h1-gatemem.json"
  - research/configs/openrouter-endpoints.json
  - docs/tasks/lead-decisions.md
supersedes: docs/log/2026-11-26-r6-failure-first-m1-pin-without-seed.md
---

**What.** The first pin of M1 (commit `1468a2b9`) took DeepSeek's own endpoint, tag `deepseek`, by the rule's first branch read literally, although that endpoint does not honour `seed`.

**Why.** The rule named the maker's endpoint first and put the `seed` condition only on its second branch. The conflict with AGENTS.md rule 6 was written down as a note instead of being settled.

**Result.** The independent review raised it (finding R6-3). The lead answered on 2026-11-26, "Seed first", directly and not under the delegation (`docs/tasks/lead-decisions.md`, "The lead's answers, 2026-11-26", answer B). A maker's endpoint without `seed` does not qualify. Commit `7ca9cd60` moved every M1 pin to `wafer/us`, and the test checks that every pinned endpoint honours `seed`. This entry corrects the superseded one, which wrongly said "the coordinator decided" (review finding 8).

**Consequence.** No run used the first pin, so there is nothing to undo outside this branch.
