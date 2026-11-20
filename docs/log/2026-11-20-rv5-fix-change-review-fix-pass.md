---
date: 2026-11-20
author: claude-agent
type: change
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/src/extension.ts
  - packages/core/src/plane/read.ts
  - packages/cli/src/commands.ts
  - packages/mcp/src/transports.ts
  - packages/mcp/src/server.ts
  - docs/dogfood.md
  - docs/decisions/0005-bi-temporal-validity.md
  - docs/decisions/0027-http-contract-client-and-inspector.md
supersedes: none
---

**What.** The review fix pass of PR #59: RV5-1 to RV5-7 fixed, each with a failure entry, a decision entry where a choice was open, and tests written red first.

**Why.** The reviewer found two blocking gaps (a name-only exemption, a head taken from the last event) and five minor ones.

**Result.** Tests added in attacks.test.ts, read-time.test.ts (both backends), cli/test/clock.test.ts and mcp/test/sessions.test.ts, with one `test.todo` for card RV7; gates in PR.md's review fix pass section.

**Consequence.** RV7's `cd` tracking closes the pending case.
