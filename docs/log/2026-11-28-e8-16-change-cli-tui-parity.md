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
  - packages/server/test/__parity__/model-operations.json
supersedes: none
---

**What.** The CLI's parity and leak suite: thirteen user operations run from one seeded state through the HTTP API, the CLI in process, the CLI against a server and the TUI's runner, and a model's five operations through MCP; every registry command probed as each actor through the CLI and the TUI, and the TUI's drawn screen after a read scanned.

**Why.** Card E8.16, step 3 and the task's instruction to include the TUI as a surface.

**Result.** `make test-one T=packages/cli/test/parity.test.ts`: 26 passed. Every operation logged the same events on all four user surfaces (byte for byte between the CLI, the TUI and the server) and reported the same reasons; 576 CLI and 581 TUI probes, no leak.

**Consequence.** A new command needs a probe or an exemption; MCP's operations are pinned in the shared snapshot.
