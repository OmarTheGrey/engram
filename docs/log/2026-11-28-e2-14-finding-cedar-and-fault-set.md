---
date: 2026-11-28
author: claude-agent
type: finding
card: E2.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - packages/core/src/plane/simulate.ts
  - packages/server/src/contract.ts
  - packages/runner/src/lint-fault-set.ts
supersedes: none
---

**What.** Three readers of a policy skipped the loader's refusal: the HTTP simulate route, whose `SimulateRequest` candidate is checked by the schema alone and run by `Plane.simulate`; `exportCedar`, which takes a policy object; and the fault set's `readSetPolicy` (`Policy.parse`).

**Why.** The refusal lived in `parsePolicy`. A raw HTTP client could simulate a policy setting an unbuilt option and read "no change" for an option the plane ignored, the case the refusal exists to prevent (the review of 2026-11-28, finding 1).

**Result.** Fixed in this card for the first two (`docs/log/2026-11-28-e2-14-shared-refusal.md`). `readSetPolicy` stays schema only: its `policy.json` comes from `lintPolicy()`, sets no option and is pinned by hash in `research/configs/h3-lint-model.json`.

**Consequence.** A card that lifts its refusal also decides whether `exportCedar` translates the option or keeps refusing it; E9.12, E2.19 and E2.21 should add `policy/cedar.ts` to their files. The route's other semantic gaps (duplicate rules, missing levels) predate this card.
