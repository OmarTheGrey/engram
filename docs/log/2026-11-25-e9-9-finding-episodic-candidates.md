---
date: 2026-11-25
author: claude-agent
type: finding
card: E9.9
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/owner-accepts.test.ts
  - packages/cli/test/import-export.test.ts
supersedes: none
---

**What.** An imported or held episodic candidate in a person scope still needs a second member, and even then becomes a semantic version, never an active episode.

**Why.** ADR 0026 promotes an episodic item only to semantic, and ADR 0049 leaves that alone (C46).

**Result.** The round trip's two confirming episodes stay candidates after import, as before.

**Consequence.** For the lead: whether an owner may accept an episodic candidate as an active episode in place, which is a further ADR 0026 change.
