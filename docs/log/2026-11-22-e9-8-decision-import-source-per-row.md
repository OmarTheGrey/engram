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
  - packages/core/src/oracle.ts
  - packages/core/src/plane/write.ts
supersedes: docs/log/2026-11-21-e9-8-decision-import-actor-attested.md
---

**What.** The cap is applied by choosing the import actor's source per row in core, not by changing how Plane.write sets provenance for a source `import`.

**Why.** Changing `withPlaneProvenance` would change what the invariants' oracle expects (`effectiveKind` takes the actor's source), a lead-owned file, and every other `import` writer.

**Result.** The import actor `import:<importer>` keeps its id, level and memberships; only its source varies, chosen by `importedWrite` from the row, never more trusted than `import`. In process the CLI is the harness, as before.

**Consequence.** Over an authenticated server the credential's source replaces it (the finding of the same day).
