---
date: 2026-11-23
author: claude-agent
type: milestone
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/rerun.test.ts
  - packages/cli/test/tui/actor-switch.test.ts
  - packages/cli/test/tui/flows.test.ts
  - packages/cli/test/tui/no-policy.test.ts
  - packages/cli/test/tui/parity.test.ts
supersedes: docs/log/2026-11-23-e8-15c-milestone-review-tests.md
---

**What.** The tests of E8.15c after the verification's fix pass: rerun (7), actor-switch (15), flows (23), parity (19), no-policy (7, with eleven probes), the frames (88).

**Why.** The verification found a rerun regression and gaps the earlier tests let through.

**Result.** Every CLI, ui and view test file: 50 files, 730 tests passed. Mutations killed this pass, each run on a committed tree: r always swapping, r swapping `--db` and `--root`, actors by id alone, a person scope prefilled, the note on the first read, and real-source forms of the destructuring, the drawn-text member, the whole answer and the constant key.

**Consequence.** None.
