---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - Makefile
  - packages/runner/scripts/h1-sessions.ts
supersedes: none
---

**What.** `make h1-table READINGS=.engram/runs/h1-unread.json` would have read the filled template and then overwritten it with a blank one (P4V-4).

**Why.** The recipe always passed `--unread-out` to the same path the readers were told to copy from.

**Result.** With `READINGS=` the recipe writes no template, and the converter refuses `--readings` and `--unread-out` naming one file (`2026-11-03-pr4-f2-readings-not-overwritten`).

**Consequence.** A step that reads a human's work never writes to the same path.
