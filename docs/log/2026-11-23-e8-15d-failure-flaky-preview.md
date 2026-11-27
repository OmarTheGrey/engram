---
date: 2026-11-23
author: claude-agent
type: failure
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/flows.test.ts
  - "ENGRAM_OFFLINE=1 pnpm exec vitest run packages/cli/test packages/ui packages/view"
supersedes: none
---

**What.** On the tree merging E8.15c's last pass, the first full run of every CLI, ui and view test failed one of 905: E8.15c's flows test "shows a denied preview's reason and policy id verbatim" saw two `/api/v1/items/check` calls where it expects one.

**Why.** Not established. The test and `screens/write.ts` are E8.15c's, byte for byte as on `origin/cliupgrade` (12b57e65); the second call looks like the write preview's timed check firing again under the load of a full run.

**Result.** The test alone passed three times out of three, and the full set again passed 905 of 905. It is a timing test under load, not a change of this branch.

**Consequence.** For E8.15c: the preview's call count may need the test clock or a wait that does not depend on load.
