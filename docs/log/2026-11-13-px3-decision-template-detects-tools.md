---
date: 2026-11-13
author: claude-agent
type: decision
card: PX3
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0001-pi-as-base.md
  - packages/pi-package/prompts/engram.md
supersedes: none
---

**What.** ADR 0001 is amended: `/engram` is one prompt template, not `registerCommand`, and each subcommand finds its tool at run time instead of naming the card it waits for.

**Why.** PR 39 departed from ADR 0001's slash-command row and logged it only as a decision entry (`docs/log/2026-11-06-px3-decision-one-engram-template.md`); a template keyed on cards stays wrong when the card lands without a pi tool, as L1 does.

**Result.** `/engram lint` calls `memory_lint` when the session registers it, else says lint is not available; `/engram simulate` reports what `memory_simulate` answers.

**Consequence.** `/engram lint` lights up when a card adds `memory_lint` to `packages/pi-extension`; that card is not on the roadmap yet.
