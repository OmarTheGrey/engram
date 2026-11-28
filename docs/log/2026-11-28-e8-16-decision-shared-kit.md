---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.16
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/leakage-kit.ts
  - packages/mcp/test/leakage-agent.ts
  - packages/server/test/__parity__/model-operations.json
supersedes: none
---

**What.** The canary workspace, its probe actors and the leak rule live in one test module, `packages/server/test/leakage-kit.ts`, which the other three suites import by relative path, with an MCP client helper in `packages/mcp/test/leakage-agent.ts` and the model snapshot in `packages/server/test/__parity__/`: three files beyond the card's four.

**Why.** Four copies of the seed would drift, and the count is only one figure if every surface plants the same canaries; the kit imports only core, so every package resolves it. The cli package has no MCP SDK, so the client helper sits where the SDK resolves.

**Result.** The script refuses records whose canaries or probe actors differ between suites.

**Consequence.** If wrong, the cost is a test file outside the card's list; nothing outside tests moves.
