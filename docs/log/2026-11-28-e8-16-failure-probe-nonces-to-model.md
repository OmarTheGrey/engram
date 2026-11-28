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
supersedes: none
---

**What.** The first pi probes read each canary by its nonce, and every probe actor's model context then held every nonce.

**Why.** The scripted model's own tool-call arguments are in the transcript: the probe, not the plane, put them there.

**Result.** The pi probes read with queries that name no nonce (`canary`, which matches every canary); the model context is clean for every probe actor.

**Consequence.** HTTP, MCP and the CLI keep the per-nonce reads, since their answers do not echo the query.
