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

**What.** `make l3-variance`, run without `OUT=`, took the Makefile's existing `OUT` as its output path, the thesis drafts folder, instead of research/results. (Corrected before merging, at review L3-8: the first wording said the run wrote there, which it did not.)

**Why.** The Makefile already sets `OUT ?= $(ROOT)/research/thesis/drafts` for `make thesis`, and make variables are global.

**Result.** That run refused before writing anything, since the pilot's model is not named in research/configs/l3-variance.json; nothing was overwritten.

**Consequence.** The target takes `FIXTURE=1` for the scripted run instead and names its paths itself.
