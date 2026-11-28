---
date: 2026-11-28
author: claude-agent
type: change
card: E8.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/parity.test.ts
  - packages/pi-extension/test/parity.test.ts
  - packages/server/test/leakage-kit.ts
  - packages/server/test/__parity__/model-operations.json
supersedes: none
---

**What.** A model's five operations now run through the HTTP API as a model-sourced actor too, and its events must equal MCP's; every parity record is computed (MCP and pi against the committed snapshot, the HTTP API against MCP); the CLI in process is the reference, not a compared surface; parity also compares ttl and the provenance kind and actor.

**Why.** Review findings 3, 4 and 8: the HTTP claim was unchecked, the records were hard-coded true, the CLI compared itself, and the comment overstated the exclusions.

**Result.** `make test-one T=packages/cli/test/parity.test.ts`: 28 passed; pi 8 passed against the regenerated snapshot.

**Consequence.** A parity mismatch now shows in the result as well as failing.
