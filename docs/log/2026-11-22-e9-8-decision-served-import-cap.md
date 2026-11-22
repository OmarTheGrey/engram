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
supersedes: docs/log/2026-11-22-e9-8-finding-credential-source-replaces-cap.md
---

**What.** The server's write and check routes pass the actor through core's `capImportSource`: an actor whose bound source is `import` writes at the least trusted of the item's claimed kind and `import` (`importKind`, which `importedWrite` also uses).

**Why.** The lead's decision on the superseded finding: a credential's source replaced the per-row cap. Plane.write and the oracle's `effectiveKind` stay unchanged, since adoption (card RV4) also writes as `import`.

**Result.** Over `listen` with an API key held at `import`, a model and an external row aimed at team scope are denied by `preset.medium/write/team`, as in process; a model row in person scope keeps kind `model`; a user row is recorded `import`. With the cap removed, 3 of the 4 server tests fail (mutation check, restored in the same call).

**Consequence.** A client can only lower trust. The route holds only the dispatch (rule 1).
