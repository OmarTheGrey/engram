---
date: 2026-11-28
author: claude-agent
type: decision
card: E1.8
chapter: design
pillar: research
hypothesis: none
evidence:
  - specs/replay.qnt
  - docs/tasks/E1.8.md
supersedes: none
---

**What.** The traces come from a schedule module beside the model, not from good's `step` directly, and `specs/commit.qnt` is untouched.

**Why.** Good's own traces put other handles inside the code's synchronous stretches, which a replay in one process cannot pause, and the card names `specs/traces/`, not the model, as its spec files. Restricting the next step keeps every trace a run of good.

**Result.** Atomic stretches and the erasure's delete order are the only restrictions; sweep and adoption orders stay free, since the replay's store lists records in the order the trace takes them.

**Consequence.** A limit, not nothing lost: a stretch is several transactions with the lock released between them, so a handle in another process can append between them (and between a sweep's or adoption's head and its list). Those interleavings are checked on the model only; the replay covers single-process schedules (`specs/README.md`).
