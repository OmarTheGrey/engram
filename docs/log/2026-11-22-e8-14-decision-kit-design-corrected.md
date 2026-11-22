---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.14
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/kit/src/index.ts
  - packages/kit/package.json
supersedes: docs/log/2026-11-21-e8-14-decision-kit-design.md
---

**What.** The kit's choices, corrected: writes carry source `model`, adapters call the generated client, the memory tag comes from `@engram/tag`, and the package is `@engram/kit`.

**Why.** The earlier entry said the kit reused `@engram/pi-extension/tag` and so installed pi; review finding E8.14-4 moved the tag.

**Result.** The kit depends on `@engram/sdk` and `@engram/tag` only; its dependency closure holds no pi (`packages/kit/test/conformance.test.ts`). ADR 0047 decision 6 records the source rule.

**Consequence.** An application that writes as a user needs another surface.
