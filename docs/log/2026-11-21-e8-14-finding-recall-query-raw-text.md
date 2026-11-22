---
date: 2026-11-21
author: claude-agent
type: finding
card: E8.14
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/ai-sdk/test/middleware.test.ts
  - packages/ai-sdk/README.md
supersedes: none
---

**What.** The middleware's recall queries with the raw last user text, so a last message full of markup recalls less: the fake store found nothing for a query mixing a forged tag with real words.

**Why.** Found while writing the forged-tag test, whose query carried the forged tag's words.

**Result.** The test now puts the forged text in earlier messages and asks a plain last message; defusing still applies to every message. Recall keyed on the last user message only is a limit the package README states.

**Consequence.** A later card could derive the recall query from more of the conversation; nothing is registered for it.
