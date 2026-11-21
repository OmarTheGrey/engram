---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/preregistration.md
  - docs/roadmap.md
supersedes: none
---

**What.** H1 runs to completion: an arm that reaches its ceiling pauses with its sessions kept, the lead decides whether to raise the ceiling and resume with `RESUME=1`, and H1 is never reported as a completed subset (the coordinator's decision under the lead's delegation, review finding ANS-4).

**Why.** H1's stopping rule is a fixed sample; the first draft let the RV1 completed-subset rule, which is H2's, reach H1, and moved the roadmap's spend risk to every run.

**Result.** H1's Stopping rule and the Models section say so; the roadmap's risk row is back to "During X6 to X8", with a second row for a run's own ceiling and the programme cap. Item 3's reason is carried: a sharded run may pass its ceiling by up to n sessions, one per shard.

**Consequence.** A paused H1 arm costs a day of the 1 to 8 December window, not its sample.
