---
date: 2026-11-22
author: claude-agent
type: change
card: E8.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/transports.ts
  - packages/server/src/app.ts
  - packages/server/src/keys.ts
  - packages/server/src/listen.ts
  - packages/server/test/auth.test.ts
  - packages/server/test/keys.test.ts
  - packages/mcp/test/auth.test.ts
  - packages/mcp/test/attestation.test.ts
  - docs/decisions/0042-verified-actors.md
supersedes: none
---

**What.** The review fix pass of card E8.12: one critical finding, two important and seven minor, each with a test written first.

**Why.** The review of the card.

**Result.** E8.12-1: the MCP guard runs on the routed path, and the handler fails closed. E8.12-2: a seeded MCP invariant. E8.12-3: the API fails closed. E8.12-4 and -5: asynchronous scrypt, with r, p and N bounded. E8.12-6: two failure entries. E8.12-7 and -10: ADR wording and two test names. E8.12-8: an https resource beyond loopback. E8.12-9: an algorithm-confusion test and a decision entry. Three entries are superseded by corrections.

**Consequence.** Every finding is closed and ready for the reviewer to re-verify.
