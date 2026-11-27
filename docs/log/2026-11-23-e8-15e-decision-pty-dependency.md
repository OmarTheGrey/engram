---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15e
chapter: design
pillar: plane
hypothesis: none
evidence:
  - package.json
  - docs/deps.md
  - packages/cli/test/tui/pty.ts
supersedes: none
---

**What.** @lydell/node-pty 1.1.0, the version ADR 0044's spike used, is a dev dependency of the root, beside playwright, since the smokes live in test/e2e.

**Why.** Its prebuilt binaries come in per-platform optional packages, so no install script and no compiler; 1.1.0 is its latest release that is not a beta and is far older than two weeks.

**Result.** Lock gains the package and its six platform packages; the smokes skip, with the reason printed, where it does not load.

**Consequence.** None.
