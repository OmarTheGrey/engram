---
date: 2026-11-25
author: claude-agent
type: change
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/line.ts
  - packages/cli/src/registry.ts
  - packages/cli/test/tui/line.test.ts
  - packages/cli/test/registry.test.ts
supersedes: none
---

**What.** Two follow-ups of the review pass. Line mode's intro names an actor the CLI refuses, with the CLI's own reason, instead of saying no one. The tui registry entry names ENGRAM_TUI_HANDBACK, the variable L's line-mode child reads.

**Why.** The reviewer's E-1 probe, rerun against the fix, gave a handoff with an invalid member scope, and the intro said acting as no one yet. registry.test.ts, which holds every variable the CLI reads to the registry, failed on the new variable.

**Result.** A line test for the refused actor; registry.test.ts passes. HELP unchanged.

**Consequence.** None.
