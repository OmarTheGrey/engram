---
date: 2026-11-20
author: claude-agent
type: change
card: RV4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/write.ts
  - packages/adapters/test/plane/rv4-files.test.ts
  - packages/adapters/test/plane/grants-files.test.ts
supersedes: none
---

**What.** Adoption never raises trust: a record as the plane holds it keeps the plane's provenance; any other is the adopter's, of the least trusted kind among its claim, the plane's item of that id and `import` (`adoptedItem`).

**Why.** Backlog row "Adoption raises trust": over the files adapter the re-adoption after a plane write raised an agent's item from `model` to `import`, and the owner's grant on it was then allowed (ADR 0021, D4).

**Result.** `pnpm exec vitest run --root packages/adapters test/plane/rv4-files.test.ts`: 10 passed. An agent item adopted three times stays `model` and the grant is refused (`engram/write/grant`); an unchanged plane-written record adopts with no event (`unchanged: 5`); a hand-edited `user` item becomes `import`, a hand-edited `model` item claiming `user` stays `model`. Mutants "kind always import" and "never keep the plane's provenance" each fail a test.

**Consequence.** Backlog row "Re-adoption of plane writes" closes too.
