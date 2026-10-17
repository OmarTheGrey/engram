---
date: 2026-10-17
author: omar
type: failure
card: S0.1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - biome.json
  - "pnpm exec biome migrate --write"
supersedes: none
---

**What.** Running `biome migrate --write` on Biome 2.5.15 to replace the deprecated `rules.recommended: true` produced `rules.preset: "none"`, which turns every lint rule off.

**Why.** The deprecation notice asked for the migration; the result was only caught because the config was read back after migrating.

**Result.** With `preset: "none"`, `make lint` passed while enforcing nothing. After setting `preset: "recommended"`, a probe file with `any`, `==`, an inner `var` and an unused variable produced four diagnostics (`noExplicitAny`, `noDoubleEquals`, `noInnerDeclarations`, `noUnusedVariables`).

**Consequence.** Any future Biome migration is followed by reading `biome.json` back and running a probe before merging.
