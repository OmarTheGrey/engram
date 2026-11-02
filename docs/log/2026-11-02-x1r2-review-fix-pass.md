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

**What.** Round 2 of PR #25's review fix pass addresses R1 to R8.

**Why.** A verifier confirmed round 1 and found that the every-term rule floored H1 out, and seven smaller defects.

**Result.** One core retrieval pipeline serves every condition on every store; the floor holds; ADR 0009's amendment is a proposal; the judge is seeded. Every cassette was recorded again by `make fixtures`, and the suite replays offline with 0 new calls.

**Consequence.** PR 3 is ready for review again.
