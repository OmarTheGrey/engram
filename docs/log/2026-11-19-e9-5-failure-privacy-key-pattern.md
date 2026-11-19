---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** The privacy test's key pattern refused the report's own key `policy_sha256`.

**Why.** The pattern allowed letters and underscores only in a top-level key.

**Result.** The pattern now allows digits after the first letter; the test passes and still refuses ids, dates and names.

**Consequence.** Nothing beyond the fix.
