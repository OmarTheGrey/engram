---
date: 2026-11-02
author: claude-agent
type: milestone
card: X1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/configs/x1-h1-probe.json
  - packages/runner/test/retrieval.test.ts
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/x1-h1-probe.json"
supersedes: none
---

**What.** Round 3 of PR #25's review fix pass addresses V-1 to V-8.

**Why.** A fresh verifier confirmed round 2's core claims, found CI red on a run output cited as evidence, and found that C4 and C5 differed by more than mechanism.

**Result.** C4 now walks the shared ranking to C5's list, so its allowed items equal C5's on every fixture checkpoint and on all 2,218 pinned ones. The retrieval tests drive each condition's own tool, and the floor tests recall. The note and the judge retry as upstream's clients do. A capped read records its cut. The Gate B record notes its dependence on the proposal. The suite replays offline twice with 0 new calls, and the log check and `make thesis` pass on the committed tree alone.

**Consequence.** PR 3 is ready for review again; ADR 0031 and ADR 0009's amendment remain the lead's.
