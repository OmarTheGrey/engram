---
date: 2026-11-19
author: claude-agent
type: decision
card: L3
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane.ts
  - packages/core/src/plane/lint.ts
supersedes: none
---

**What.** The model lints run inside Plane.lint, after the deterministic ones, only when the plane is built with `lintModel`; all calls run in the lint's queue slot before anything is appended.

**Why.** Rule 4 puts the call at construction. Recording findings needs the plane; holding the slot keeps the findings about one projection; appending last makes a failed call (an offline miss) leave the log as it was.

**Result.** Without a lint model the report has no judgments and nothing changes for the server or CLI; a failing call rejects the lint with no event, deterministic findings included (packages/core/test/unit/plane/lint-model.test.ts).

**Consequence.** A lint over a large scope holds the write queue while the model answers; the runner lints scratch logs, so nothing waits there.
