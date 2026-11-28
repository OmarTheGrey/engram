---
date: 2026-11-28
author: claude-agent
type: failure
card: E8.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/test/parity.test.ts
  - packages/server/test/__parity__/model-operations.json
supersedes: none
---

**What.** pi's first parity run, on the fake store, did not match MCP's snapshot recorded on the files store.

**Why.** Two canaries tie on score in the read; their order is the store's search order.

**Result.** Moved pi's run to the files store (decision `2026-11-28-e8-16-decision-pi-files-store.md`); the snapshot matches.

**Consequence.** None beyond the decision.
