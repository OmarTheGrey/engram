---
date: 2026-11-21
author: claude-agent
type: decision
card: B11
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - Makefile
  - packages/bench/src/tau2/env.ts
  - packages/bench/scripts/run-tau2.ts
supersedes: none
---

**What.** `make bench BENCH=tau2` first runs `run-tau2.ts --setup`, which checks the pinned checkout and tau2's environment and, only when one is missing, fetches tau2 at the pin and runs `uv sync --frozen --no-dev --python 3.12` into `.engram/tau2-venv`; then the replay under ENGRAM_OFFLINE=1. `make fixtures` records the cassettes with `--record` from the scripted upstream, as it does GateMem's.

**Why.** The card asks for a fresh clone to replay with one command, and fetching pinned code is allowed where a model call is not. Under ENGRAM_OFFLINE=1 the fetch is refused with the missing parts named.

**Result.** On a ready machine the setup step prints `tau2: ready ... (pin checked)` and touches nothing; a checkout with any change is refused as not the pinned harness.

**Consequence.** A first run needs the network once (about 60 MB of git objects and tau2's locked packages).
