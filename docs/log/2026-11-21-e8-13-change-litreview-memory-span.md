---
date: 2026-11-21
author: claude-agent
type: change
card: E8.13
chapter: related-work
pillar: research
hypothesis: none
evidence:
  - docs/readings/litreview/repo-otel-genai-semconv.md
  - "gh api repos/open-telemetry/semantic-conventions-genai/git/ref/tags/v0.1.0"
supersedes: docs/log/2026-11-21-e8-13-finding-genai-memory-span.md
---

**What.** The literature note `repo-otel-genai-semconv.md` gains a dated correction: release v0.1.0 of `open-telemetry/semantic-conventions-genai` (commit d0e74ba, 2026-11-21) defines the memory span `gen_ai.memory.client`, with its seven operations and its attributes, the content ones opt-in.

**Why.** Review finding E8.13-5. The literature review is the project's source of truth, and three of the note's lines said no memory span was defined and asked whether to propose one.

**Result.** The original lines are kept, each marked as corrected, with the correction at the end; it also corrects the note's `sdk-trace-base` 2.12.0 pin.

**Consequence.** The earlier finding's last line, that the note was left for its owner, no longer holds.
