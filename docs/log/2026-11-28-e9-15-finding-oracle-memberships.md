---
date: 2026-11-28
author: claude-agent
type: finding
card: E9.15
chapter: limitations
pillar: govern
hypothesis: none
evidence:
  - research/results/h1-audit-report.json
  - packages/core/test/unit/audit/report.test.ts
supersedes: none
---

**What.** The report's oracle count is the dogfood report's, and the log records no memberships, so a reader not declared to it is judged by its own scope alone: in the fixture, dana's read of a team item she may read through `team:platform` is counted as one read violation.

**Why.** The first run expected zero and failed (logged apart); the cause is the oracle's documented default, not a defect of the gate.

**Result.** Core takes `declared` actors (with dana declared the count is 0, and verify needs the same declaration); the CLI does not yet expose a declaration flag, so its reports state `declared: 0` and a note saying how undeclared readers are judged.

**Consequence.** For the lead or a follow-up card: a `--declare` flag on `audit export` and `audit verify`, or recorded memberships, before the oracle count is used as evidence on a real log.
