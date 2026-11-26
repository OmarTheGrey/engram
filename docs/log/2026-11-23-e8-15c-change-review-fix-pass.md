---
date: 2026-11-23
author: claude-agent
type: change
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/actor.ts
  - packages/cli/test/tui/actor-switch.test.ts
  - packages/cli/test/tui/no-policy.test.ts
  - packages/cli/test/tui/parity.test.ts
  - packages/cli/test/tui/flows.test.ts
supersedes: none
---

**What.** The review fix pass of E8.15c: the one critical, six important and seven minor findings and the three UX items, each test first and in its own commit.

**Why.** The review of E8.15c (scratchpad review-e8-15c.md) and the lead's decisions on findings 1 to 3.

**Result.** No screen draws an answer made as another actor, and r reruns as the actor now. The handoff reaches an allowed promotion. Grants sends a pending change. The no-policy guard walks the syntax tree. Parity checks meaning. Supersede plans again after accepting. ASCII folds draw `+`. `ENGRAM_OFFLINE=1 pnpm exec vitest run packages/cli packages/ui packages/view`: every file passes (counts in milestone-review-tests). The reviewer's s2, s3 and s6 rerun under ConPTY: the note never shows to sam, the handoff lands, the unseen event is said.

**Consequence.** The merge with E8.15d is the coordinator's; the harnesses treat auto-run screens as already run.
