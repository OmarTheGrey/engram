---
date: 2026-11-28
author: claude-agent
type: change
card: E8.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/test/parity.test.ts
  - packages/server/test/__parity__/model-operations.json
supersedes: none
---

**What.** The pi extension's parity and leak suite in a real pi SDK session with the scripted model: the model's five operations matched against the snapshot MCP matches, and each probe actor's session scanned, tool by tool, in the model's context and in the session record.

**Why.** Card E8.16: the pi extension reaches the Plane directly, not through the client, so parity with the other surfaces has to be shown, not assumed.

**Result.** `make test-one T=packages/pi-extension/test/parity.test.ts`: 8 passed. pi's answers and events equal MCP's through `model-operations.json`; 48 probes, nothing leaked to the model or the session; the control's model is sent the team's canaries.

**Consequence.** The four surfaces agree through one committed file; a change to either side's decision fails one of the two suites.
