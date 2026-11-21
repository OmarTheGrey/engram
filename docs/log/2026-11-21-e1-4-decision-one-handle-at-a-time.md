---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** The stateful model runs one live handle at a time (a reopen replaces it); interleavings of two handles stay with the two-handle walk of the invariants file.

**Why.** The card names the overlap with the walk as a risk. fc.scheduler interleavings and fc.commands sequences multiply each other's cost and make shrinking slow; the walk already covers interleavings at the store's calls, so this file spends its budget on longer sequences of every operation, crashes and reopens.

**Result.** Default 200 runs of up to 40 commands in about 3 s; the walk is unchanged. Two-handle crash windows are covered deterministically by crash-windows.test.ts (D4, D5 pause one handle while another offboards).

**Consequence.** If wrong, a race between a reopened handle and a still-running one is not generated here; the walk and the crash-window cases are where it would be caught.
