---
date: 2026-11-25
author: claude-agent
type: decision
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/E2.15.md
  - docs/log/2026-11-22-e9-8-finding-credential-source-replaces-cap.md
  - docs/log/2026-11-22-l6-finding-close-provenance-trust.md
supersedes: none
---

**What.** Two questions the first wave left for the lead are decided here: the import cap moves into `Plane.write` for every `import`-sourced actor, and a close that changes only `valid_to` keeps the item's provenance.

**Why.** Neither is money or the pre-registration. Rule 1 puts the cap in core rather than in key issuance, and a close changes no content, so it should not change who the content came from.

**Result.** Card E2.15 builds both, with finding E14-F3, after measuring them against every H1 to H4 MANIFEST row.

**Consequence.** If the lead disagrees, the close rule is one function and the cap one check, both easy to reverse.
