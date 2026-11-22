---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/who-can-read.test.ts
  - packages/core/policies/medium.yaml
supersedes: none
---

**What.** The CLI test's first run expected a grantee to see one members entry and its grant, and saw two members entries.

**Why.** A wrong expectation: the medium preset lets both the person and the role level read a person scope, so the answer correctly has a row for each.

**Result.** The test now expects the person and role rows, then sam's own grant; 4 of 4 pass.

**Consequence.** Nothing in the code changed.
