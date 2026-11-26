---
date: 2026-11-22
author: claude-agent
type: milestone
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/flows.test.ts
  - packages/cli/test/tui/parity.test.ts
  - packages/cli/test/tui/no-policy.test.ts
  - packages/cli/test/tui/frames-memory.test.ts
  - packages/cli/test/view-deps.test.ts
  - packages/view/test/package.test.ts
supersedes: none
---

**What.** The tests of E8.15c: flows (16), parity (17: eleven actions in process, six against a server), no-policy (6), frames of eleven screens at 80x24 and 120x40 in four modes (88 snapshots), the CLI's dependency graph (3), the view package (3).

**Why.** Card E8.15c's acceptance and `docs/design/tui.md` 13.

**Result.** `ENGRAM_OFFLINE=1 pnpm exec vitest run packages/cli packages/ui packages/view`: 48 files, 698 tests passed. Mutations, each restored in the same call, all killed: the leak rule, the handoff saved, the preview on every key, the handoff offered with credentials, undo not inverting, the read not asking, no other view, validation drawing ids, a rule id and a branch on a reason in a screen, xyflow in the view package.

**Consequence.** E8.15d's parity test extends parity.test.ts's CASES.
