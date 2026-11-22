---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/ui/src/provenance.ts
  - packages/ui/test/provenance.test.ts
  - packages/core/src/visible.ts
supersedes: docs/log/2026-11-21-e8-11-decision-leak-rule.md
---

**What.** The leak rule stands as decided, with one correction: an allowed promotion is shown by visibleEvents to a reader of its source scope as well as of its target, so such a reader gets a node for the promoted item, whose content is not shown.

**Why.** Review finding E8.11-6: the earlier entry and the comment in provenance.ts said a creating event is shown only to a reader of its scope, which core's visible.ts contradicts for promotions.

**Result.** The node shows only the id the promotion event already shows on the timeline. Its state, lineage included, is withheld, so no lineage links it and no version of it is offered. A new unit test covers a team item promoted to org for a viewer who cannot read org. The comment is corrected.

**Consequence.** Not a leak; no change of behaviour.
