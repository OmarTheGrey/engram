---
date: 2026-11-27
author: claude-orchestrator
type: change
card: E9.9
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/cli/src/registry.ts
  - packages/cli/test/help-main.txt
  - packages/cli/test/tui/__frames__/memory-promote-120x40-default.txt
  - docs/decisions/README.md
supersedes: none
---

**What.** Main was merged into E9.9 (through L8, #124). Two conflicts. The ADR index keeps main's acceptance rows for 0042 to 0048 and E9.9's row for 0049. `run.ts` takes main's version, whose help is built from the command registry (E8.15, #114); E9.9's two help changes (promote `--review` names the owner's acceptance in a person scope, ADR 0049; import says how a candidate becomes active) move into `registry.ts`, the flag's TUI help included, and into the help reference `help-main.txt`. The four promote frame goldens show the new help, cut at the frame's width as every long help line is.

**Why.** The TUI landed after E9.9 was verified, so its help moved out of `run.ts`.

**Result.** `packages/cli/test`: 939 of 939 pass.

**Consequence.** The CLI and TUI both describe ADR 0049's acceptance.
