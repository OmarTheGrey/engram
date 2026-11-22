---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.14
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/tag/src/index.ts
  - packages/tag/test/tag.test.ts
  - packages/kit/test/conformance.test.ts
supersedes: none
---

**What.** The pure memory-tag code moves into a new pi-free package, `@engram/tag` (the lead's decision on review finding E8.14-4, ADR 0033).

**Why.** The kit and `@engram/ai-sdk` imported `@engram/pi-extension/tag`, which installs pi with them.

**Result.** `@engram/tag` holds `recallDetails`, `tagRecall`, `tagUngovernedRead`, `neutraliseTags`, `neutraliseAcross`, `WITHHELD`, `MEMORY_READ`, `MEMORY_WRITE` and `writeResultText`; its only workspace dependency is core, for types. The pi extension imports and re-exports them, and its context handler stays. The MCP server, the kit and ai-sdk import it. The suite checks that an adapter's closure holds no `@earendil-works/*`; kit and tag pass, pi-extension fails.

**Consequence.** Biome's pi import rule and AGENTS.md cover `packages/tag`.
