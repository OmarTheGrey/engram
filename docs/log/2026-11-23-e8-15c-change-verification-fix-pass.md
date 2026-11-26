---
date: 2026-11-23
author: claude-agent
type: change
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/rerun.test.ts
  - packages/cli/test/tui/actor-switch.test.ts
  - packages/cli/test/tui/no-policy.test.ts
  - packages/cli/test/tui/flows.test.ts
supersedes: docs/log/2026-11-23-e8-15c-change-review-fix-pass.md
---

**What.** The verification's fix pass of E8.15c: N1 (critical), N2 (important) and N3 to N5, each test first.

**Why.** The verification of the review fix pass (scratchpad review-e8-15c.md, appended section) and the lead's decisions on N1 to N5. The earlier change entry's r and ASCII fold no longer hold.

**Result.** r runs the command line that ran, swapping only the actor's flags after a change of actor. An actor is its id, level and memberships. The syntax-tree guard closes five gaps. The handoff never prefills a person scope. A later read's note has its own row. The ASCII fold is `~`. `ENGRAM_OFFLINE=1 pnpm exec vitest run packages/cli packages/ui packages/view`: 50 files, 730 tests passed; `make lint` and `make lint-docs` pass; the reviewer's zz-rv-rerun, zz-rv-switch and zz-rv-switch2: 7 passed, 2 skipped by the probe itself.

**Consequence.** E8.15d merges again after this push.
