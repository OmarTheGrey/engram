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

**What.** `key create`, `key list`, `key revoke` and `log verify`, `log checkpoint` are separate entries; `read --item` is an entry whose name carries the flag and whose positional is its value; import stays a plain handler, not split.

**Why.** Each subcommand needs its own form and `writes`; `read --item <id>` builds its command line from name plus positional; import makes one write call per row, so it has no single call to split.

**Result.** `parse` on an entry names the handler's config when it is more than the form's flags (key's union, read's `--item`). Export is a PlaneCommand whose print is async, since it encrypts.

**Consequence.** If wrong, the TUI forms of these commands need regrouping; the plain CLI is unaffected.
