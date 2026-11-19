---
date: 2026-11-19
author: claude-agent
type: failure
card: L3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - Makefile
supersedes: none
---

**What.** The first `make l3-variance` took `OUT=` for its output file and wrote to the thesis drafts folder instead of research/results.

**Why.** The Makefile already sets `OUT ?= $(ROOT)/research/thesis/drafts` for `make thesis`, and make variables are global.

**Result.** The run refused before writing (the pilot's model is not named), so nothing was overwritten.

**Consequence.** The target takes `FIXTURE=1` for the scripted run instead and names its paths itself.
