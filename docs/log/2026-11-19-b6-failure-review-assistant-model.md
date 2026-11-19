---
date: 2026-11-19
author: claude-agent
type: failure
card: B6
chapter: limitations
pillar: research
hypothesis: H2
evidence:
  - docs/log/2026-11-19-b6-finding-assistant-model-keys.md
  - packages/core/src/schema.ts
supersedes: none
---

**What.** Review P6-4: my finding said naming B5's assistant model would change nothing for C2 and C5; it changes the write events.

**Why.** I checked the prompts and the cassette keys by replay, not the Engram log, whose write events carry the item with its provenance.

**Result.** Superseded by `docs/log/2026-11-19-b6-finding-assistant-model-events.md`, and L2's claim about the keys by `docs/log/2026-11-19-b6-finding-l2-assistant-model-keys.md`.

**Consequence.** None for the code.
