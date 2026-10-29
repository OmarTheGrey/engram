---
date: 2026-10-29
author: claude-agent
type: finding
card: B3
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - fixtures/bench/gatemem/README.md
  - "make bench BENCH=gatemem DRY=1"
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/b3-gatemem-plane.json"
supersedes: none
---

**What.** What GateMem's agent-visible fields say about sharing, on the full pinned set (91 episodes, fetched by the dry run).

**Why.** ADR 0030's mapping can express only what those fields carry.

**Result.** 85 episodes list relationships, 90 types with no documented semantics; their fields name principals, groups (project, program, case, household, course, building) or free-text restrictions (`access_scope` 275 times, plus `scope`, `access_level`, `service_scope`); one has an `expires` date, and one `guest_id` (`guest_noah_kim`) names a guest who is not a principal. No turn has `record_refs` or `memory_ops`, so deletions exist only as sentences. In the B3 forgetting probe the deleted staging token reaches the Monsoon security engineer's context on both stores (`context leak true`), since relationships, not deletions, set reach.

**Consequence.** Forgetting checkpoints need a deletion mechanism the mapping lacks; the GateMem arm reports it.
