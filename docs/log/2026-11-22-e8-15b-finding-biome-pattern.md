---
date: 2026-11-22
author: claude-agent
type: finding
card: E8.15b
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - biome.json
  - pnpm exec biome lint packages/core/src/zz-probe.ts
supersedes: none
---

**What.** The existing pattern `@earendil-works/pi-*/**` does not match a bare `import ... from "@earendil-works/pi-tui"`.

**Why.** ADR 0044 decision 2 left it unverified and asked E8.15b to check with a failing import.

**Result.** A probe file in packages/core/src importing pi-tui linted clean against main's biome.json (`Checked 1 file ... No fixes applied`). So the core override's guard against a bare pi package import rested on its `paths` entries alone, and pi-tui had none.

**Consequence.** Every override now names `@earendil-works/pi-tui` as an exact path; the core override gained it too. A future pi package needs its exact path in each override, not only the pattern.
