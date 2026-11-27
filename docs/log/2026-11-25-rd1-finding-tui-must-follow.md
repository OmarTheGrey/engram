---
date: 2026-11-25
author: claude-agent
type: finding
card: RD1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/visible.ts
  - packages/cli/test/read-disclosure.test.ts
supersedes: none
---

**What.** For the TUI on branch `cliupgrade`: the read and by-id routes, explain, events, promote, export and supersede now return a non-owner only the grants naming it and only the lineage ids it may ask for by id, with `grants_used` renumbered. A grant change's event reason is neutral to anyone but its maker and the owner.

**Why.** The TUI's `J` view prints the CLI's bytes, and its screens show grants, events and lineage. No JSON shape changed: arrays are shorter, never new fields (`make api-check` clean).

**Result.** E8.15c's finding (`read --json` naming unreadable ancestors) is closed at the route. The TUI needs no change to be safe. A test pinning the old bytes for a grantee, or an index above 0, would need its expectation updated.

**Consequence.** When `cliupgrade` merges main, rerun its TUI leak tests; its own leak rule for lineage can stay.
