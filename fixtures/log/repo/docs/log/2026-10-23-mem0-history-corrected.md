---
date: 2026-10-23
author: fixture
type: finding
card: A2
chapter: related-work
pillar: govern
hypothesis: none
evidence:
  - https://docs.mem0.ai/
supersedes: docs/log/2026-10-18-mem0-history-gap.md
---

**What.** Mem0 does keep update history, behind a separate endpoint.

**Why.** The earlier finding missed the endpoint.

**Result.** The history endpoint returns every version of a memory.

**Consequence.** The adapter sets native_history.
