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

**What.** The presets' properties checked by Cedar's symbolic compiler on the Cedar export, a proof of concept on the registered presets' own text, no hypothesis result.

**Why.** The lead asked that a measurement showing the system working be a reproducible result.

**Result.** 13 checks: 11 proved, 2 refuted, both refutations reproduced by the evaluator, 13 as expected (`summary`). Proved for every request in the domain: strict allows no read medium denies, nor medium one permissive denies; under each preset a model-sourced write lands only in a person scope its writer is a member of; a person scope's item is read only by a member or under a live grant. The control, the converse of the first, is refuted twice: an episodic person item 30 to 90 days old, and an org reader of a role scope. Proofs hold modulo grants.

**Consequence.** The register lists it as a proof of concept.
