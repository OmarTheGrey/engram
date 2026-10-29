---
date: 2026-10-29
author: claude-agent
type: failure
card: E8.3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/scripts/api.ts
  - sdk/ts/src/schema.ts
supersedes: none
---

**What.** openapi-typescript rendered the recursive `JsonValue` component as a property type that names itself, which TypeScript rejects (TS2502).

**Why.** Core's `JsonValue` (`z.json()`) is recursive, and component types are properties of one interface, which cannot refer to themselves that way.

**Result.** The generator maps `JsonValue` to `unknown` through openapi-typescript's `transform` option; the OpenAPI document keeps the recursive schema.

**Consequence.** Clients see structured item content as `unknown` and narrow it themselves.
