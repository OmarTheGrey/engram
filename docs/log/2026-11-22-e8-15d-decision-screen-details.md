---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15d
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/machine.ts
  - packages/cli/src/tui/screens/data.ts
  - packages/cli/src/tui/screens/setup.ts
  - packages/cli/src/tui/screens/policy.ts
supersedes: none
---

**What.** Smaller calls the design left open: Doctor runs on enter, not on opening, and reads its checks from doctor's fixed columns; Lint's header does not name the lints the policy enables; the hook's roots start from the workspace's store folder; a new key is shown with "copy it now" and no copy button; Import's confirmation counts the rows of a plain bundle only.

**Why.** Opening a screen should not run a slow command; naming the lints would be a second call per lint; a copy with no clipboard path is printed on quit, which would print the key; a sealed bundle cannot be counted before it is opened.

**Result.** The parity test checks doctor's text against its `--json` run; the flows check each screen.

**Consequence.** Each is a small change if the lead prefers otherwise.
