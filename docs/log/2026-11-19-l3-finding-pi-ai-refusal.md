---
date: 2026-11-19
author: claude-agent
type: finding
card: L3
chapter: limitations
pillar: plane
hypothesis: H3
evidence:
  - packages/core/src/lint/model.ts
supersedes: none
---

**What.** pi-ai 1.3.0's chat-completions adapter does not read the provider's `refusal` field, so a structured-output refusal reaches a ModelCall as empty text.

**Why.** The reply parser needs to tell a refusal from malformed output.

**Result.** In pi-ai's dist, `refusal` appears in anthropic-messages.js, openai-decisions.js, openai-responses-shared.js and compat-schema.js, and not once in openai-completions.js, the API the runner seeds; the parser therefore reads an empty reply as a refusal.

**Consequence.** A refusal written as prose ("I can't help with that") is counted malformed, not refused; both are unjudged, so only the split between them is affected.
