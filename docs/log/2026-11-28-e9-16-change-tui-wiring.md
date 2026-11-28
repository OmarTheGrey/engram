---
date: 2026-11-28
author: claude-agent
type: change
card: E9.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/registry.ts
  - packages/cli/src/tui/screens/data.ts
  - packages/cli/test/tui/parity-surfaces.test.ts
  - packages/cli/test/tui/__frames__/
supersedes: none
---

**What.** Both commands are in the registry with `home: false`: the log verify screen gains a Record of processing button (audit ropa's generated form), the export screen a Subject access export button (export --subject's form), and the palette lists both.

**Why.** Home at 120x40 is full (addendum); each command must be reachable from a relevant screen.

**Result.** The CLI project passes after the palette, export and log verify frames were regenerated on purpose (32 frames, only the new buttons and palette rows moved); the parity and keys tests name both commands.

**Consequence.** nothing
