---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
  - packages/core/src/dogfood.ts
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** Review finding E95-1 (critical) of PR #48: the detector checked who changed a grant, never what the grant was.

**Why.** `grantChangePermitted` passed any owner's `engram/grant/change`, so a grant to `person:*` or `*`, one with no class or no expiry, and one on content still recorded as `model` counted as permitted, and the reads they admitted as clean.

**Result.** `grantChangeProblem` now also requires every added grant to pass `grantAllowed`, be of the item's class and unexpired at the event, no grant twice, no grant on untrusted content or on an item that held it, and a write `writeForbidden` permits. Tests plant each case and expect `grant_change` 1; mutants dropping each check fail them.

**Consequence.** The report judges what was granted, not only who granted it.
