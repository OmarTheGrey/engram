---
date: 2026-11-19
author: claude-agent
type: change
card: RV3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass/shell.ts
  - packages/core/test/unit/no-bypass.test.ts
  - "curl -s https://registry.npmjs.org/@letta-ai%2fletta-code (name, dist-tags, bin, license only)"
supersedes: none
---

**What.** The store-command check blocks Letta Code's npm package spec, `@letta-ai/letta-code`, with or without a version, as a route of the `letta` store (review finding RV-ADP-8).

**Why.** `npx @letta-ai/letta-code` runs Letta Code's CLI, but the word does not read as `letta` after the check strips the scope and path, so it passed.

**Result.** The name was verified first from the npm registry's metadata: package `@letta-ai/letta-code`, latest 0.34.66, binary `letta` (`letta.js`), Apache-2.0, repository letta-ai/letta-code. No package was installed. `npx`, `npx -y` with a version, `pnpm dlx` and `bunx` with `@latest` are blocked in core's unit test; all four passed the old check.

**Consequence.** ADR 0014's amendment of card RV3 lists it beside `@engram/cli`.
