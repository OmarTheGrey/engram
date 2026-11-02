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
  - packages/runner/test/x1.test.ts
  - packages/runner/test/retrieval.test.ts
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/x1-h1-probe.json"
supersedes: none
---

**What.** The review fix pass of PR #25 (card X1) addresses findings P3-1 to P3-13, J1 and J2.

**Why.** An independent review found that C5 was not C2 plus the plane's filter, that C4 showed another policy, and eleven smaller defects.

**Result.** Run twice offline, the suite printed "3 configs, 46 sessions; model calls in all: 0 new, 109 from cassettes" both times. The retrieval property holds on all 20 fixture checkpoints. Every cassette was recorded again by `make fixtures`.

**Consequence.** PR 3 is ready for review again; ADR 0031 waits for the lead.
