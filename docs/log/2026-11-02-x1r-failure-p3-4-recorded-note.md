---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/mem-inv-probe.ts
supersedes: none
---

**What.** Eight MEM-INV-Bench attack cases showed every model the reference model's recorded note, while upstream writes it with the model under test.

**Why.** PR 3 treated the note as world state and did not check how upstream builds it.

**Result.** The runner writes it with the model under test, as upstream does.

**Consequence.** Found by the independent review of PR #25 and fixed in its review fix pass.
