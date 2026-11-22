---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.13
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/export/otel.ts
  - "gh api repos/open-telemetry/semantic-conventions-genai/contents/docs/gen-ai/gen-ai-spans.md?ref=v0.1.0"
supersedes: none
---

**What.** The span follows the GenAI memory span `gen_ai.memory.client` (semantic-conventions-genai v0.1.0, commit d0e74ba): a write is `upsert_memory`, a read `search_memory`, an update, promotion or gate `update_memory`, a retire or eviction `delete_memory`, and a lint or blocked bypass `engram.lint` or `engram.bypass_blocked`. Kind is internal, a deny is status error with `error.type` `engram.denied`, and trace and span ids are the event id's hex.

**Why.** Plane.write may create or rewrite, which the conventions call upsert; retire is the plane's delete; no well-known name fits a lint or a bypass, and custom names are allowed. Ids from the event make a span the same on every export.

**Result.** Pinned in `GENAI_SEMCONV` and tested in the mapping test.

**Consequence.** An upstream rename lands in this one file.
