---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.12
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/schema.ts
  - packages/core/src/policy/consent.ts
supersedes: none
---

**What.** An opt-out's `source` matches the provenance kind the plane records for the write (the harness's source), and no actor-scoped opt-out is built.

**Why.** E2.14's gap (b): `source` is a `ProvenanceKind` in the schema, and naming one actor (Claude Code, say) would be a second schema pull request, which rule 5 and the plan rule out here.

**Result.** "From my agent" is `source: model`, "from my tools" `source: tool`. The card's risk (a writer on a person's behalf must pass the person's id) is met by the scope: an opt-out matches the item's scope, whoever writes it, so any writer into `person:dana` meets Dana's opt-outs.

**Consequence.** If an actor-scoped opt-out is needed, a schema card adds it; recorded as a finding.
