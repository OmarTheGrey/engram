---
date: 2026-11-21
author: claude-agent
type: finding
card: E1.6
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/chain.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** For the lead: only the CLI keeps the chain; the pi extension, the runner and the bench open their own handles and append no links.

**Why.** Keeping the chain needs a salt source at the boundary, and card E1.6 touches no package but core and cli.

**Result.** A log the pi extension writes beside the CLI verifies FAILED at its first unchained event (chain.test.ts, the unkept-handle case), which is the honest answer but a false alarm for a legitimate writer.

**Consequence.** A backlog row asks the pi extension to call keepChain on the log it opens.
