---
date: 2026-11-22
author: claude-agent
type: milestone
card: E8.15d
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/flows-surfaces.test.ts
  - packages/cli/test/tui/frames-surfaces.test.ts
  - packages/cli/test/tui/__frames__/surface-serve-80x24-default.txt
  - packages/cli/test/tui/snippets.test.ts
  - packages/cli/test/tui/parity-surfaces.test.ts
supersedes: none
---

**What.** Card E8.15d's tests: snippets (17), parity (29), key flows (12), snapshot frames (96: twelve screens, 80x24 and 120x40, four modes, fixed content).

**Why.** docs/design/tui.md 13 and the card's acceptance.

**Result.** All pass. The flows cover retain's strong dialog (Cancel focused, enter cancels), Serve creating a key then starting and stopping, and stopped by quitting with its note, Keys revoking with the id typed, Export saying whether the file exists, Import's row count and decisions, Doctor taking Serve's bind flags, a duplicate fault's finding, Simulate's steps and an unsigned log. Mutation checks, each restored by git checkout in the same run: 13 of 15 killed; the two survivors were equivalent (a child that never started still read as failed; the frame cuts every line anyway), and their stronger replacements were killed.

**Consequence.** E8.15e's line mode and manual check build on these screens.
