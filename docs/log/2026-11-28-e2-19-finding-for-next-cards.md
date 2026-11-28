---
date: 2026-11-28
author: claude-agent
type: finding
card: E2.19
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - fixtures/mutants
  - packages/core/src/plane/approvals.ts
  - docs/conventions/testing.md
supersedes: none
---

**What.** Three items for the next cards. The gate mutation audit has no mutant for the tenth invariant: adding one moves `h1-gate-mutation-audit.json`, which this card may not move. Card D5's `hold`, when merged, opens a request through its `gate` ask and is released by a routed approver, so its release reason should ride on the promote. E8.8 wires the methods to routes, MCP, the CLI and a TUI screen.

**Why.** The convention asks a new invariant for a mutant; the plan's guard forbids moving the row here.

**Result.** The mutants were run by hand instead (see the milestone entry).

**Consequence.** The lead or E8.8 adds the approval mutants with the row's rerun.
