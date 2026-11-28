---
date: 2026-11-28
author: claude-agent
type: change
card: L9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/options.ts
  - packages/core/src/policy/load.ts
  - packages/core/src/policy/cedar.ts
  - packages/core/test/unit/policy/load-options.test.ts
  - packages/core/test/unit/lint/evidence.test.ts
supersedes: none
---

**What.** `lints.model.evidence` is built: its row of `NOT_BUILT_YET` is deleted, so the loader, `Plane.simulate` and `exportCedar` take it; card E2.14's test drops its two L9 rows, and `evidence.test.ts` adds the loader test.

**Why.** The addendum of 2026-11-28 evening: building an option deletes its row and states the Cedar export's behaviour (ADR 0041).

**Result.** "on" and "off" load as written; no registered preset sets the option (the preset hash test is unchanged); `exportCedar` of medium with it on, off or absent gives the same export, and `Plane.simulate` takes a candidate setting it.

**Consequence.** Six rows remain in `NOT_BUILT_YET`. The comment in `schema.ts` saying nothing builds the options is now stale; only card E2.8 edits that file (see the finding).
