---
date: 2026-11-28
author: claude-agent
type: finding
card: E9.16
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/cli/test/subject-export.test.ts
  - packages/core/src/visible.ts
supersedes: none
---

**What.** A subject's bundle carries the retire event of their own item that a promotion superseded, and its reason names the successor's id ("superseded by <id>, its promotion to a semantic item in team:ops"), even where the successor is in a scope the subject cannot read and the closure only counts it.

**Why.** visible.ts shows an event leaving a member scope to that scope's members, with its reason; ADR 0047's by-id rule, which the closure uses, would not show that id.

**Result.** Pinned as it stands in the acceptance test: the id appears once, in that reason; the successor's content in its own scope is not exported.

**Consequence.** For the lead or a disclosure card (RD1's line): whether a retire reason should name a successor the reader may not ask for by id. Not changed here.
