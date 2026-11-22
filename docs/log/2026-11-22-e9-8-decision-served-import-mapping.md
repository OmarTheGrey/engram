---
date: 2026-11-22
author: claude-agent
type: decision
card: E9.8
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/portable.ts
  - packages/server/src/routes.ts
  - packages/server/test/import-cap.test.ts
  - "make test-one T=packages/server/test/import-cap.test.ts"
supersedes: docs/log/2026-11-22-e9-8-decision-served-import-cap.md
---

**What.** The served write and check routes map an `import`-sourced actor's write as a whole imported row, in core's `servedImport`: kind the least trusted of the claim, the kind the plane holds for the id, and `import`; status candidate unless retired; no grants; owner the importer.

**Why.** The lead's decision on finding E9.8-8: the kind cap alone let an import key rewrite an agent's `model` item to `import`, and write rows active, granted and owned by someone else.

**Result.** Over `listen` with an import key: a rewrite of a model item keeps `model`, a retired model row the key wrote stays `model`, and a row sent active with grants and another owner lands a candidate owned by dana with no grants. Without the held kind 2 of 7 fail (mutation check).

**Consequence.** Plane.write, adoption and the oracle are unchanged; the route fetches the held item through core's `itemById`.
