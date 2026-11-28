---
date: 2026-11-28
author: claude-agent
type: measurement
card: E2.18
chapter: results
pillar: plane
hypothesis: none
evidence:
  - research/results/h2-cedar-properties.json
  - research/configs/h2-cedar-properties.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h2_cedar_properties.py --config research/configs/h2-cedar-properties.json --out research/results/h2-cedar-properties.json"
supersedes: none
---

**What.** The presets' properties checked by Cedar's symbolic compiler on the Cedar export: a proof of concept on the registered presets' own text, not a hypothesis result.

**Why.** The lead asked for it as a reproducible result.

**Result.** 31 checks: 11 proved, 20 refuted, every refutation reproduced by the evaluator, 31 as expected (`summary`). Proved in the stated domain: strict allows no read medium denies, nor medium one permissive denies; a model-sourced write lands only in a person scope its writer is a member of; a person scope's item is read only by a member or under a live grant. Refuted as expected: the control (the converse of the first) and the non-vacuity checks (every left set allows some request for each action; model writes and non-member reads under a grant happen). Proofs hold of the export, modulo grants (`scope`).

**Consequence.** The register lists it as a proof of concept.
