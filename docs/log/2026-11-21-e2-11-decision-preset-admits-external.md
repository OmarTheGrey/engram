---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/policies/medium-trust.yaml
supersedes: none
---

**What.** The `medium-trust` preset admits `external` in person scope, which medium does not.

**Why.** Without it every sourceless write is denied, a refusal rather than a floor, which ADR 0040 rejected as an alternative.

**Result.** A sourceless writer writes into its person scope at the lowest trust; team and higher refuse it (source not allowed, then source isolation).

**Consequence.** If wrong, the preset's floor becomes a refusal; one line of YAML.
