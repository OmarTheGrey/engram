---
date: 2026-11-21
author: claude-agent
type: finding
card: B7
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/bench/PINS.md
  - packages/bench/src/merit/launch.ts
  - packages/bench/src/merit/env.ts
supersedes: docs/log/2026-11-21-b7-finding-harness-at-pin.md
---

**What.** What MERIT's harness does at the pin, corrected after review findings B7-2 and B7-8.

**Why.** The earlier entry said the process gets no provider key; a `.env` on LiteLLM's search path could still give it one.

**Result.** LiteLLM sends `model`, `messages`, `tools` and `temperature` only, and echoes `provider_specific_fields` in assistant messages (hashed, stable). It fetches its price map unless LITELLM_LOCAL_MODEL_COST_MAP=True, and loads a `.env` unless LITELLM_MODE is not DEV; the launcher sets both. The process gets a fixed environment with no provider key and loads no `.env`. The lock installs on Windows with colorama 0.4.6 added, now pinned by a constraints file.

**Consequence.** Recorded in PINS.md's notes.
