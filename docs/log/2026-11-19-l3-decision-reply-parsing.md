---
date: 2026-11-19
author: claude-agent
type: decision
card: L3
chapter: design
pillar: plane
hypothesis: H3
evidence:
  - packages/core/src/lint/model.ts
  - packages/core/test/unit/lint/model.test.ts
supersedes: none
---

**What.** A reply is one JSON object, alone or in one markdown fence, whose trimmed verdict in any letter case is one of the lint's two; an empty reply is a refusal; anything else is malformed. Neither is retried, and neither is a finding.

**Why.** The rule must be fixed before the tag. A retry of the same request is a cache hit; a different request would change the protocol. Counting a refusal as a finding would count noise.

**Result.** Refusals and malformed replies are returned in LintReport.judgments, append no event, and the variance script reports them as the unjudged rate per seed.

**Consequence.** H3's model tier counts an unjudged unit as not flagged for recall and reports how many there were.
