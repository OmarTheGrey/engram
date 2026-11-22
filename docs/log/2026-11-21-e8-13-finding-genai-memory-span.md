---
date: 2026-11-21
author: claude-agent
type: finding
card: E8.13
chapter: related-work
pillar: research
hypothesis: none
evidence:
  - "gh api repos/open-telemetry/semantic-conventions-genai/contents/docs/gen-ai/gen-ai-spans.md?ref=v0.1.0"
  - docs/readings/litreview/repo-otel-genai-semconv.md
  - "gh api repos/open-telemetry/semantic-conventions-genai/releases"
supersedes: none
---

**What.** The GenAI conventions' first release, v0.1.0 of `open-telemetry/semantic-conventions-genai` (2026-11-21, commit d0e74ba), defines a memory span (`gen_ai.memory.client`) with operations `create_memory`, `search_memory`, `update_memory`, `upsert_memory` and `delete_memory`, and attributes `gen_ai.memory.record.id`, `.record.count` and `.store.id`.

**Why.** The literature note `repo-otel-genai-semconv.md` says no memory span definition was found, and asks whether Engram should propose one upstream.

**Result.** It exists now, all Development status, with its content attributes (`gen_ai.memory.records`, `gen_ai.memory.query.text`) opt-in and not captured by default, which matches rule 12. The note's pin of `sdk-trace-base` 2.12.0 cannot pair with api 1.10.0 (peer `<1.10.0`).

**Consequence.** E8.13 maps onto the upstream memory span; the note's open question is answered. The note itself is left for its owner to update.
