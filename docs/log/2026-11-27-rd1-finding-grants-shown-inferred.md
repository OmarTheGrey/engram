---
date: 2026-11-27
author: claude-agent
type: finding
card: RD1
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/view/src/view.ts
  - packages/cli/src/tui/screens/rich.ts
  - packages/cli/test/tui/known-answer.test.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Whether the grants shown of an item are all of them is still inferred outside core, for the label only (verification N2).

**Why.** Core's answers carry no such field and only card E2.8 changes the schema. `readWhole` infers it from an empty `grants_used`, which holds because core admits by scope before grants. The TUI's `knownAnswer` takes every answer that is not a read as whole, which is wrong for an owner who cannot read the item's scope and gets a promotion's answer.

**Result.** The grants listed are core's in every case; only the "every grant is shown" label can be wrong. New test `known-answer.test.ts` pins both branches of `knownAnswer` (4 passed); making the non-read branch not whole fails one. Backlog row "Grants shown, stated by core" asks core for the field, its own PR after H1.

**Consequence.** When the field lands, `shownGrants` takes it and `readWhole` goes.
