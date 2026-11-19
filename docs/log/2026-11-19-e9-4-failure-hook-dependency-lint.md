---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/ui/src/App.tsx
  - "pnpm exec biome check --error-on-warnings packages/ui"
supersedes: none
---

**What.** Biome refused the first version of the inspector's reset on a change of viewer: an effect on `[viewer]` that clears the grant decision and the timeline filters, without reading the viewer, is an extra dependency to `useExhaustiveDependencies`.

**Why.** Once a grant change re-reads the lanes, the reset could no longer live in the read's effect, or every grant change would reset the timeline's filters.

**Result.** The reset moved into the handler the viewer picker calls (`chooseViewer`), so a new viewer resets the filters and clears the decision and a re-read after a grant change keeps them. The inspector's earlier Chromium test that a viewer change resets the filters passes.

**Consequence.** None.
