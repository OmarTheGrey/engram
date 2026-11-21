---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.7
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - "make test-one T=packages/core/test/counterexamples/trust.test.ts"
  - packages/core/test/counterexamples/trust.test.ts
  - packages/core/src/plane/write.ts
  - packages/cli/src/setup.ts
  - packages/cli/src/commands.ts
  - packages/mcp/src/server.ts
  - packages/mcp/src/hook.ts
  - packages/pi-extension/src/extension.ts
  - packages/server/src/routes.ts
  - packages/server/src/contract.ts
  - packages/core/src/plane/simulate.ts
  - packages/core/src/plane/adopt.ts
  - packages/runner/src/conditions.ts
supersedes: none
---

**What.** GH-39 is confirmed: a sourceless `Plane.write`, `checkWrite` or simulated write claiming `user` into team scope under medium is allowed at kind `user` and the claimed actor; labelled `model`, it is denied.

**Why.** ADR 0040 builds its floor only on what this proves.

**Result.** Refuted cells: adoption records `import`; a sourceless grant change is denied (`engram/grant/source`). Sources: CLI `user` for write, promote, retain, lint (`setup.ts:86`; `commands.ts:338,410,501,546`), none for read and explain, which write nothing; MCP and hook `model` (`server.ts:115`, `hook.ts:130`); pi `model` for the agent (`extension.ts:224`), the session's actor as given for sweeps; HTTP the body's actor (`routes.ts:93`, `contract.ts:26`); simulator the workload's (`simulate.ts:242`); adoption `import` (`adopt.ts:199`).

**Consequence.** No registered number moves: every benchmark writer sets a source (GateMem, LongMemEval, MEM-INV-Bench, the H3 faults); the sourceless actors only read and sweep, and C5's agent is `model`.
