---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
  - packages/core/src/policy/cedar.ts
  - "make test-one T=packages/core/test/property/cedar.test.ts"
supersedes: none
---

**What.** After merging main at 0102643f, which brings card E2.9's secret and personal-data guard into `evaluateWrite`, the export still agrees with the evaluator.

**Why.** E2.9 added a write check (`contentGuard`, `engram/write/secret`, `/pii`, `/content-size`, `/guard-failure`) that the export does not translate.

**Result.** `contentGuard` returns null for a policy without the block or with every guard off, and no preset sets the block, so the presets are unchanged. `exportCedar` refuses `secrets`, `pii` or `max_content_bytes` set to anything but off, as it refuses the injection screen. The differential test passes 15 of 15 and `make test-invariants` 17 of 17 after the merge.

**Consequence.** Translating the content guards would need regular expressions over content in Cedar, which it has only as `like`; they stay an excluded class.
