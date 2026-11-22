---
date: 2026-11-22
author: claude-agent
type: finding
card: L6
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/test/supersede.test.ts
  - packages/core/src/policy/trust.ts
supersedes: docs/log/2026-11-21-l6-finding-model-close-provenance.md
---

**What.** What an agent's close does to a user-written fact depends on the preset.

**Why.** The review (L6-4) found the earlier finding incomplete: it described only medium.

**Result.** On medium-trust, the agent's close through memory_supersede is denied under engram/write/downgrade, and the owner's own close as a user is allowed. On the registered medium, the agent's close is allowed and the fact's provenance becomes kind model. Over HTTP with credentials, the credential's source is the writer's (E8.12), so these hold for that source. Three MCP tests cover the first two.

**Consequence.** Under medium an agent can turn a person's fact into a model-written one by closing it. The lead may want medium-trust for agents, or a close that keeps provenance; the latter is a write-path change.
