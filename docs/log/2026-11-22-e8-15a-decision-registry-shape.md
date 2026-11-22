---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15a
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/registry.ts
supersedes: none
---

**What.** The CommandSpec of 6.1 gains `usage`, `title`, `listed`, `parse`, `helpAfter` and `listedIn`, and `summary` is the right column of HELP's list rather than the whole line.

**Why.** Main's HELP is not one block per command: key's three subcommands share one line and one section, who-can-read's and log's sections sit away from their list position, and the store, actor and export headings list commands. Reproducing it byte for byte needs these fields.

**Result.** Shared headings are generated from `listedIn`, so L6 and E9.8 needed no hand edit to them. Handlers are reached by dynamic import, so the registry imports no command module and there is no import cycle.

**Consequence.** A command is one entry, plus its handler in `H`; the shared client paragraph stays verbatim text.
