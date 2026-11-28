---
date: 2026-11-28
author: claude-agent
type: decision
card: E1.7
chapter: design
pillar: research
hypothesis: none
evidence:
  - specs/commit.qnt
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** The purge's new check under the lock is not a step of its own in the model: `adoptOne` holds the refusal and the check, and a retry's check is `adoptOne`'s deferral.

**Why.** In the code the check runs in the same synchronous stretch as the refusal, with no store call between, so the replay could not separate them; a separate step would break the schedule.

**Result.** Traces and scenarios replay as the model states (199 of 200). In another process a change can land between the refusal and the check, which the check catches, and between the check and the delete, which only a write decided before the removal can be, and its own commit refuses it.

**Consequence.** Cost if wrong: a cross-process interleaving between the refusal and the check is reasoned, not model-checked.
