---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.7
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/setup.ts
  - packages/cli/src/commands.ts
  - packages/cli/src/doctor.ts
  - packages/mcp/src/server.ts
  - packages/mcp/src/hook.ts
  - packages/pi-extension/src/extension.ts
  - packages/server/src/routes.ts
  - packages/server/src/contract.ts
  - packages/server/src/workspace.ts
  - packages/ui/src/data.ts
  - packages/core/src/plane/before-read.ts
  - packages/core/src/plane/simulate.ts
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** How each surface sets the actor's source, the list of the GH-39 floor finding completed (it moved here for the word limit).

**Why.** Only a caller that sends no source reaches GH-39.

**Result.** CLI: `user` for write, promote, retain, lint (`setup.ts:86`; `commands.ts:338,410,501,546`); none for read and explain. A CLI or HTTP read is not write-free: the owner's sweep and adoption run first as the store's owner with `import` (`before-read.ts:87-91`; server `storeOwner`, `workspace.ts:486-488`). `engram doctor` writes as `user` (`doctor.ts:158-162`). MCP server and hook: `model` (`server.ts:115`, `hook.ts:130`). Pi: `model` for the agent (`extension.ts:224`), the session's actor as given for sweeps. HTTP: the body's actor, any source or none (`routes.ts:93`, `contract.ts:26`). The inspector reads with no source and changes grants as `user` (`data.ts:56,105`). Simulator: the workload's (`simulate.ts:242`). Adoption: `import` (`adopt.ts:199`).

**Consequence.** HTTP clients and library callers are the open paths.
