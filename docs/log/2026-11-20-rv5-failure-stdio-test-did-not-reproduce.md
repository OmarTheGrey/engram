---
date: 2026-11-20
author: claude-agent
type: failure
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/test/rv5.test.ts
supersedes: none
---

**What.** The first RV-SRF-7 test passed against the old stdio transport, so it did not reproduce the finding.

**Why.** In process the in-memory write answered before the input's `end` event, and the SDK's response handler kept the transport it was given, so the reply reached the pipe after close anyway; the real loss is the process exiting while a reply is still pending.

**Result.** The test now goes through a client that answers 200 ms late and checks the reply is written before `serveStdio` returns; it fails against the old transport and passes against the new one.

**Consequence.** Nothing further; noted so a later reader does not trust an in-memory stdio test that never waits.
