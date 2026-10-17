---
date: 2026-10-18
author: fixture
type: finding
card: PX1
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - fixtures/sessions/s0-interception.jsonl
supersedes: none
---

**What.** The context event sees messages but not the system prompt.

**Why.** The read filter must know what reaches the model.

**Result.** The session fixture shows the event payload without the system prompt.

**Consequence.** Recall injected through the system prompt is outside the filter.
