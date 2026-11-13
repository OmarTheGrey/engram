---
date: 2026-11-06
author: claude-agent
type: decision
card: E9.1
chapter: design
pillar: govern
hypothesis: none
evidence:
  - packages/pi-package/profiles/knowledge.yaml
  - docs/readings/litreview/2606.24322-origin-bound-authority.md
supersedes: none
---

**What.** "Provenance required for org" is read as org's sources being first-hand only (user and document); "validity required" as the schema's valid_from, the read filter's window and the expired-validity and source-changed lints; "review for promotion" as requires_review on team and org.

**Why.** Every item already carries a provenance, so the card's words only bite on which kinds org takes. Tool output can echo an outsider (2606.24322's trusted-tool echo), and an import names no one who vouches for it. The policy language has no field that requires valid_to.

**Result.** A tool, import or model write to org is denied, and so is a promotion of such content, since a promotion is a write under the target's rule (ADR 0026).

**Consequence.** Requiring valid_to is a schema change, left for the lead; the profile's numbers are proposals until dogfood (E9.5).
