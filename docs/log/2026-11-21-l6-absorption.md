---
date: 2026-11-21
author: claude-agent
type: change
card: L6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/absorbed.md
  - NOTICE
  - "gh api repos/getzep/graphiti/contents?ref=9b8a4630092084734b080f2e6f409c2c23bdcc3a --jq .[].name"
supersedes: none
---

**What.** Three rows went into docs/absorbed.md: Graphiti (port), gaptime (port) and Remnic's supersession chain (copy). NOTICE gained Remnic's entry, plus courtesy notices for the two ports.

**Why.** Rule 16: the core commit's header said Remnic's notice was in NOTICE, but neither file had been touched.

**Result.** The licences were read in the files fetched at the pinned commits into .engram/upstream (git-ignored): Apache-2.0 for gaptime (with its NOTICE) and Graphiti, MIT for Remnic. `gh api` lists only LICENSE at Graphiti's commit. Remnic's resolver is near-verbatim, so it is a copy; the other two are rewritten over Engram's types, so they are ports.

**Consequence.** None.
