---
date: 2026-11-23
author: claude-agent
type: failure
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/app.ts
supersedes: none
---

**What.** The first mutation run of the Serve smoke kept its backup of app.ts in the wrong place, so two mutants stayed applied together and the third ran on top of them.

**Why.** A cp fallback in the script wrote the backup to /tmp, not the path it restored from.

**Result.** app.ts was restored from the /tmp copy, its E8.15e changes checked present, and the three mutants run again one at a time with byte comparisons after each.

**Consequence.** None.
