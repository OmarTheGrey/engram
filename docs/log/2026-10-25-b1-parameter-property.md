---
date: 2026-10-25
author: claude-agent
type: failure
card: B1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/gatemem/agents.ts
  - packages/bench/scripts/run-gatemem.ts
supersedes: none
---

**What.** The first run of `packages/bench/scripts/run-gatemem.ts` failed with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` on the reference agent's constructor.

**Why.** The constructor used a TypeScript parameter property (`private readonly options`), which Node 24's type stripping does not support; vitest transforms it, so only the plain `node` run caught it.

**Result.** The field is declared and assigned explicitly; the script runs under `node` with no build step, as the other repository scripts do.

**Consequence.** Code reached by `node <file>.ts` avoids parameter properties, enums and namespaces.
