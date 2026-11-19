---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/offboard.ts
  - docs/decisions/0007-write-gate-and-source-isolation.md
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
supersedes: docs/log/2026-11-19-e2-6-verify-decision-marks-close-earlier.md
---

**What.** The sweep notes the log's head before each listing and, after deleting a record, checks its item under the lock; if it changed, the projected item is written back and no swept event is appended. A report still closes the marks open when its own began.

**Why.** Keeping a scope frozen until every running offboarding ends needs a way to tell a running offboarding from a crashed one, a lease the log does not have; protecting the write is enough for the design rule.

**Result.** Q1 passes, and so does V3-5's test of marks begun after.

**Consequence.** Two overlapping offboardings reopen the scope at the earlier-begun one's closing report.
