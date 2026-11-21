---
date: 2026-11-21
author: claude-agent
type: change
card: E8.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/commands.test.ts
  - "make test-one T=packages/cli/test/commands.test.ts"
supersedes: none
---

**What.** The help snapshot in `packages/cli/test/commands.test.ts` (card E8.2's) gains the new "export options" section, copied from `run.ts`'s HELP.

**Why.** The card adds two flags; the snapshot holds the full help text and fails on any addition.

**Result.** Only the new section was added; the test passes, 5 of 5.

**Consequence.** Nothing else in that test changed.
