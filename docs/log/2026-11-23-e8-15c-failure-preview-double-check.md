---
date: 2026-11-23
author: claude-agent
type: failure
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/write.ts
  - packages/cli/test/tui/flows.test.ts
supersedes: docs/log/2026-11-23-e8-15d-failure-flaky-preview.md
---

**What.** The flow test "shows a denied preview's reason and policy id verbatim" failed once in 905 on the merged tree: two `/api/v1/items/check` calls where it expects one.

**Why.** A real double request, not the test's clock: Check again ran the check at once but left the 400 ms pause of the last keystroke pending, so the pause sent the same check again when it ended. Under load the test took longer than 400 ms between its last key and its count; a person who presses Check again within 400 ms of typing gets the same two checks.

**Result.** Not reproduced by load (0 of 8 under eight busy processes); reproduced every time once the pause's scheduler was injected and fired after Check again: 2 calls.

**Consequence.** Fixed by change-preview-check-once.
