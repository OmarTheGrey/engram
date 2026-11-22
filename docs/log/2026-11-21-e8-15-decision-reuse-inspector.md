---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.15
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/design/tui.md
  - packages/ui/src/view.ts
  - packages/ui/src/provenance.ts
supersedes: none
---

**What.** The TUI reuses the inspector's pure view functions (`buildLanes`, `laneGroups`, `filterEvents`, `eventDetail`, `explainView`, `provenanceGraph`, `itemVersions`, `itemEvents`, `grantFrom`) through a proposed subpath export `@engram/ui/view`.

**Why.** The inspector's grouping, filters and the item page's leak rule (card E8.11) are tested; copying them into the CLI would let two surfaces drift, and the leak rule is the kind of logic that must not exist twice.

**Result.** Section 6.3; the export lists only the pure modules, never React, and changes no inspector behaviour.

**Consequence.** For the lead (section 14, item 4); the alternative is moving the modules to a shared package, which touches the inspector more.
