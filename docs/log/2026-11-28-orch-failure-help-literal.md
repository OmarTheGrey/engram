---
date: 2026-11-28
author: claude-orchestrator
type: failure
card: E8.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/commands.test.ts
  - "make test-one T=packages/cli/test/commands.test.ts"
supersedes: none
---

**What.** Main's two help tests in `packages/cli/test/commands.test.ts` had failed since card E8.17 (#148): it registered `hook codex` and `hook install`, and the test's help literal was not updated. The literal is regenerated from the registry's HELP; the diff is exactly E8.17's lines.

**Why.** E8.17's agent and the orchestrator ran the registry and parity tests, not this file. Cards E2.17 and D5 found it.

**Result.** 5 of 5 pass.

**Consequence.** The orchestrator runs the whole CLI project before every merge, as it now does for core.
