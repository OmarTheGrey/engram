---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - docs/log/2026-11-02-pr2-finding-mem-inv-admission.md
  - packages/runner/src/research/mem-inv-admission.ts
supersedes: none
---

**What.** Review finding P2-8: the admission finding left out that under strict the trusted ERP and bank filler also waits as a review candidate.

**Why.** The result recorded only the marked entries, so it could not show that strict leaves the operator no `team:operations` record at all, a utility cost beyond the benign values.

**Result.** The admission rows now carry every entry and the result counts entries by scope and the attacks' filler.

**Consequence.** The admission measurement and finding are superseded; the result stays on the 24 vendored cases until PR 3's 38-case set merges.
