---
date: 2026-11-23
author: claude-agent
type: milestone
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/actor-switch.test.ts
  - packages/cli/test/tui/flows.test.ts
  - packages/cli/test/tui/parity.test.ts
  - packages/cli/test/tui/no-policy.test.ts
supersedes: docs/log/2026-11-22-e8-15c-milestone-tests.md
---

**What.** The tests of E8.15c after the review fix pass: actor-switch (14), flows (21), parity (19), no-policy (6, the syntax-tree guard and the survivors among them), the frames (88), the view package (3) and the CLI's dependency graph (3).

**Why.** The review found the first set did not catch an actor switch, let a branch on a reason through, and replayed argv tautologically.

**Result.** Every TUI test file passes: 10 files, 314 tests. Mutations killed, each restored in the same call: the actor filter, the stale guard, the item page's filter, the form's workspace sync, the follow restart, follow while covered, the handoff target alone, the extra write flag, dropping opened grants, both undo guards together, the unseen event selected, Who asking twice, no re-plan, J's failure text, and the reviewer's nine no-policy mutants.

**Consequence.** None.
