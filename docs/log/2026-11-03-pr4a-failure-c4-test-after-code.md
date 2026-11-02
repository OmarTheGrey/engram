---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/c4-evidence.ts
  - packages/runner/test/research/c4-evidence.test.ts
supersedes: none
---

**What.** The C4 evidence module was written before its vitest file, so its tests were first seen passing, never failing.

**Why.** The module wrapped two existing development scripts and was written in one pass from them; the testing convention asks for the failing test first.

**Result.** The gap was closed after the fact by mutation: with the work committed (`cc14a86`), swapping the C3-only and C4-only leak counts failed "a denied leak item one list shows and the other does not is counted on the right side", and inverting the plane's verdict failed "the verdicts counted are the ones C4 shows under each source"; each file was restored by copy. The Python aggregation tests were written first and failed on the missing scripts.

**Consequence.** The later deliverables of this PR write the test first.
