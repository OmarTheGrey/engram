---
date: 2026-11-06
author: claude-agent
type: decision
card: PX3
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/pi-package/prompts/engram.md
  - docs/decisions/0001-pi-as-base.md
supersedes: none
---

**What.** The four Engram commands are one prompt template, `engram.md`, taking the subcommand as its first argument (`$1`, rest `${@:2}`), not four templates or a `registerCommand` handler.

**Why.** Pi 1.3.0 prompt templates take positional arguments, so one template gives `/engram explain|lint|simulate|policy` under one name; four templates would be `/engram-explain` and so on. A registered command would put command logic in the extension, while the work is the model calling the Engram tools.

**Result.** `get_commands` lists one `engram` prompt from the package (`packages/pi-package/test/install.test.ts`).

**Consequence.** This departs from the slash-command row of ADR 0001's mapping table (`registerCommand`). A subcommand that later needs code instead of a model turn moves to a registered command.
