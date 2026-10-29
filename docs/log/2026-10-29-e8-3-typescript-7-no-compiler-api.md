---
date: 2026-10-29
author: claude-agent
type: finding
card: E8.3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/package.json
  - docs/deps.md
supersedes: none
---

**What.** The `typescript` 7.0.2 package ships the native compiler only, without the JavaScript compiler API, which openapi-typescript builds its output with.

**Why.** Generating the client failed to find `ts.factory` until a TypeScript the generator could use was installed.

**Result.** packages/server pins `typescript` 5.9.3 as a dev dependency, which pnpm resolves as openapi-typescript's peer; `make lint` still type-checks with 7.0.2 from the root.

**Consequence.** Any other tool that needs the compiler API (a codemod, a doc generator) must bring TypeScript 5 the same way until TypeScript 7's API ships.
