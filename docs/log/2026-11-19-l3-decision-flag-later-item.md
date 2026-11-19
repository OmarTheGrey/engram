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
supersedes: none
---

**What.** A contradiction verdict flags the later item of the pair by id and names the earlier in its evidence, as the duplicate lint keeps the earliest.

**Why.** Which side is wrong is not knowable from the pair; the later item introduced the conflict, and flagging both would count the original as a false positive in every seeded contradiction.

**Result.** One finding per contradicting pair (packages/core/test/unit/lint/model.test.ts).

**Consequence.** Card L2's labels must mark the injected (later) item as the one the contradiction lint finds; an injected item with an earlier id than its original would be missed by this rule.
