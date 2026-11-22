---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.6
chapter: related-work
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/chain.ts
  - packages/core/src/log/verify.ts
  - docs/absorbed.md
supersedes: none
---

**What.** caura's canonicalisation lessons and Compartment's head and count anchor are taken as ideas, not ports: no absorbed.md row, cited in the file headers.

**Why.** Review finding E1.6-9: the card lists both as Apache-2.0 ports, but neither repository was opened at a commit; only the research report's summary was used.

**Result.** chain.ts and verify.ts say the timestamp, number and anchor rules come from the research report; huqan, world-model-mcp and octopus-blackboard, read at their commits, keep their rows.

**Consequence.** A later card that ports code from caura or Compartment reads them at a commit and adds the rows.
