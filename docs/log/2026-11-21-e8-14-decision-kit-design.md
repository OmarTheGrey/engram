---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.14
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/kit/src/index.ts
  - packages/kit/package.json
supersedes: none
---

**What.** Four kit choices: writes always carry source `model`; adapters call the generated client, never core; the memory tag is reused from `@engram/pi-extension/tag`; the package is `@engram/kit`, as the card names it, not the research note's `@engram/framework-kit`.

**Why.** A framework's writes are agent writes, as for MCP; the client keeps an adapter out of reach of logs and stores; one tag keeps escaping in one place.

**Result.** The kit depends on `@engram/sdk` and `@engram/pi-extension`, which brings pi into the install, though tag.ts loads only types. Biome's pi import rule now covers the kit and ai-sdk.

**Consequence.** An application that writes as a user needs another surface; moving tag.ts into a pi-free package would drop pi from the install.
