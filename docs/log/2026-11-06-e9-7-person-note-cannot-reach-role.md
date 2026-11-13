---
date: 2026-11-06
author: claude-agent
type: finding
card: E9.7
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/pi-package/profiles/twin.yaml
  - fixtures/profiles/offboarding.json
supersedes: none
---

**What.** The first offboarding fixture promoted one of Dana's person notes into role:lead, reviewed by Sam, and the promotion was denied.

**Why.** Widening an active semantic item needs a reviewer who can read it (ADR 0026), and in a twin no one but its owner can read a person scope, while an owner may not approve their own item.

**Result.** Under the twin profile a person note never reaches a role by promotion; a person restates it in the role instead. The fixture keeps a fifth person note and no promotion.

**Consequence.** If Twin needs a person-to-role path, a grant to the reviewer or a self-approval rule for one's own role is a policy decision for the lead.
