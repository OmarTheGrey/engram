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
  - packages/runner/src/model/retry.ts
  - packages/core/test/unit/lint/model.test.ts
supersedes: docs/log/2026-11-19-l3-decision-reply-parsing.md
---

**What.** A reply is one JSON object, alone or in one markdown fence, whose trimmed verdict in any case is one of the lint's two; empty is a refusal; anything else is malformed. No reply is asked for again because of how it parses.

**Why.** Review L3-8 and L3-6: the live call does retry transient failures (429, 5xx, network errors; 3 attempts, same request, JUDGE_RETRY), which is transport, not parsing; and the reading of adversarial replies must be fixed too.

**Result.** Extra fields are accepted; a flag inside prose, two objects and text after a fence are malformed; a duplicated verdict key is read last-wins. Refusals and malformed replies are judgments, never events.

**Consequence.** H3's model tier counts an unjudged unit as not flagged and reports the unjudged rate per seed.
