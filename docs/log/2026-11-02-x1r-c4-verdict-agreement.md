---
date: 2026-11-02
author: claude-agent
type: finding
card: X1
chapter: discussion
pillar: research
hypothesis: H1
evidence:
  - packages/runner/scripts/compare-c4-verdicts.ts
  - "node packages/runner/scripts/compare-c4-verdicts.ts .engram/upstream/gatemem/bench/data"
supersedes: none
---

**What.** GateMem's RAG-Policy verdict and the plane's read decision under `medium` disagree on more than a quarter of the turn items H1's GateMem arm would show.

**Why.** C4 showed the RAG-Policy verdict while C5 enforced the plane's (review finding P3-2).

**Result.** Over 325,530 turn items up to the 2,218 checkpoints, for each asker: 235,384 agree (72.3 percent), 60,305 allowed by the rule table and denied by the plane (18.5 percent), 29,841 the reverse (9.2 percent). On turns holding an access-control checkpoint's leak target, the table allows 1,528 of 5,259 and the plane 722; on forgetting checkpoints 2,389 and 2,298 of 5,467. Counts printed by the command above; shares computed from them.

**Consequence.** PR 4 measures these shares with a research script (rule 9); C4's default is the plane's verdict.
