---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.21
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - docs/decisions/0041-cedar-export-for-analysis.md
supersedes: docs/log/2026-11-28-e2-21-decision-cedar-refuses.md
---

**What.** The Cedar export still refuses `grants.expiry_cap: "on"`, with its ground restated.

**Why.** The review (finding 4): ADR 0041's decision 5 is the export's stated scope, agreement modulo grants; it does not say the export refuses what it cannot translate, and read alone it would let a grant-only rule be exported modulo grants.

**Result.** The refusal and the header comment now say: the cap and the first-write rule judge each grant against the event's time, which the export does not model, outside its stated scope (decision 5); the option is refused rather than flattened, as content guards and trust options are. Off is still exported. The test still pins "grant by grant".

**Consequence.** As before: exporting either profile needs the option off, or a card that models the event time per grant.
