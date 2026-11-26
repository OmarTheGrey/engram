---
date: 2026-11-26
author: claude-agent
type: finding
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/README.md
  - Makefile
  - node packages/cli/src/main.ts --help
supersedes: none
---

**What.** How the revised READMEs were checked, and what was left out or left alone.

**Why.** No claim without evidence (AGENTS.md rule 9), and the brief asked for every command to exist.

**Result.** Each command shown is a Makefile target or in `engram --help`; the quick start's write, read, who-can-read and `log verify` ran on a scratch folder. The brief named ADR 0049; the index ends at 0048, so none is cited. Unchanged, still accurate: `packages/kit`, `packages/ai-sdk`, `packages/tag`, `specs/` and `docs/compliance/`.

**Consequence.** `packages/cli/README.md` and the root README conflict with `cliupgrade`'s edits; these versions contain them, so the merge takes these.
