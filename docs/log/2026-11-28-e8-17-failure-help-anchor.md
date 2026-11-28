---
date: 2026-11-28
author: claude-agent
type: failure
card: E8.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/registry.test.ts
supersedes: none
---

**What.** Moving `log verify`'s `helpAfter` to `hook install` broke the reproduction of main's HELP ("helpAfter hook install names no section").

**Why.** Main's HELP is rebuilt from main's commands only, where `hook install` does not exist.

**Result.** `helpAfter` restored to `hook claude-code`; the new sections follow it in registry order, and the registry's 49 tests pass.

**Consequence.** Nothing.
