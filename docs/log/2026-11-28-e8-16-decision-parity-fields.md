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
  - packages/cli/test/parity.test.ts
  - packages/pi-extension/test/parity.test.ts
supersedes: none
---

**What.** Parity compares each logged event's decided fields (op, item id, actor, scopes, decision, reason, rule id) and its item's plane fields, every id made blind by first appearance; the provenance ref and hash and the store ref are left out. The CLI, the TUI and the CLI against a server are compared byte for byte.

**Why.** The provenance ref and hash are each surface's own label (MCP's request id, pi's tool call id, the CLI's `engram-cli`), and the HTTP side's body is written by hand; requiring them equal would test the label, not the decision.

**Result.** All user and model operations agree on those fields.

**Consequence.** A surface that changed the decision, reason, rule or item would fail; one that changed only its label would not.
