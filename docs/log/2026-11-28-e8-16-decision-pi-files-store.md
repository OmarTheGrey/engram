---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.16
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/test/parity.test.ts
  - packages/server/test/__parity__/model-operations.json
supersedes: none
---

**What.** The pi extension's parity run uses the files store, as the CLI's MCP run does, not the fake store the other pi tests use.

**Why.** A read's items tied on score are ranked in the store's own search order, so the snapshot of a read holds for one store; the fake store ordered two tied canaries the other way.

**Result.** pi's five operations match MCP's snapshot on the files store.

**Consequence.** Parity across stores for ties is not claimed; the leak probes run on the files store too.
