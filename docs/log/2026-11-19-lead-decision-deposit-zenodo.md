---
date: 2026-11-19
author: omar
type: decision
card: R1
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/decisions/0023-preregistration-in-repo.md
  - docs/research/preregistration.md
  - docs/tasks/prereg-v1-plan.md
supersedes: none
---

**What.** The tagged pre-registration is deposited on Zenodo.

**Why.** ADR 0023 mirrors the pre-registration externally on OSF or Zenodo and left the choice of venue to the lead.

**Result.** v1's version paragraph and step 4 of section 7 of `docs/tasks/prereg-v1-plan.md` name Zenodo, where they said "OSF or Zenodo".

**Consequence.** After the tag `prereg-v1`, the lead deposits the text on Zenodo and records the deposit's address in a `milestone` entry.
