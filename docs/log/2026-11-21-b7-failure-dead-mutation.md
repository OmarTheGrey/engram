---
date: 2026-11-21
author: claude-agent
type: failure
card: B7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/test/merit/seam.test.ts
  - packages/core/policies/permissive.yaml
supersedes: none
---

**What.** A first mutation check did not bite: loading preset permissive in place of the config's left the 4 seam tests passing.

**Why.** Permissive also refuses model-sourced writes to team scope, so the denial test cannot tell the two presets apart.

**Result.** The mutation that routes C5 to the ungoverned backend fails 2 of the 4.

**Consequence.** None.
