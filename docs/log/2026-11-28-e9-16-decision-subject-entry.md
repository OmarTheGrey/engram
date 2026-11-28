---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.16
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/cli/src/registry.ts
  - packages/cli/test/registry.test.ts
supersedes: none
---

**What.** `--subject` is a flag of `engram export`, registered as its own entry `export --subject <person>` as `read --item` is read's, and runs on this machine only.

**Why.** The card names `engram export --subject`. As a plain export flag its help lines changed main's help for export, which the registry test pins to main byte for byte; a separate entry keeps export's help as it was. The closure reads the projection from the log, which a server does not hand out, and adding a route would mean `make api`, which this card does not run.

**Result.** Export's help, form and frames are unchanged; `--subject` with `--server` is a usage error.

**Consequence.** A served subject export needs a route of its own and `make api`, a later card's. Cost if wrong: one more registry entry to fold back into export.
