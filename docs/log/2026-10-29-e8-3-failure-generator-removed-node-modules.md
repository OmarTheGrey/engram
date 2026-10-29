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
supersedes: none
---

**What.** The first `make api` generator emptied `sdk/ts` before writing it and so deleted the `node_modules` link pnpm had made there.

**Why.** Generated folders are emptied so a file the generator no longer writes cannot linger; `sdk/ts` is also a workspace package with installed dependencies.

**Result.** `tsc` failed to find `openapi-fetch` from `sdk/ts/src/index.ts` until `pnpm install` ran again. The generator now keeps `node_modules` when it empties `sdk/ts`.

**Consequence.** `make api` can run after `pnpm install` in any order.
