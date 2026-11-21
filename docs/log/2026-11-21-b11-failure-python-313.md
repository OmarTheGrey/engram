---
date: 2026-11-21
author: claude-agent
type: failure
card: B11
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/tau2/env.ts
supersedes: none
---

**What.** The first tau2 environment, built with `uv sync --frozen --no-dev --python 3.13`, could not import tau2.

**Why.** The tag declares `requires-python = ">=3.12,<3.14"`, but `tau2.voice.utils.audio_preprocessing` imports `audioop`, removed from the standard library in 3.13, and tau2's package root imports it through the runner.

**Result.** `ModuleNotFoundError: No module named 'audioop'`. Rebuilt with Python 3.12 (3.12.12) from the same lock: tau2 imports, LiteLLM 1.81.11 and openai 2.20.0 as locked.

**Consequence.** env.ts pins Python 3.12 for tau2's environment.
