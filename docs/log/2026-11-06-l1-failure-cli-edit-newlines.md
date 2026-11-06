---
date: 2026-11-06
author: shady
type: failure
card: L1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/commands.ts
supersedes: none
---

**What.** The first run of `engram lint` failed with a TypeScript syntax error in packages/cli/src/commands.ts.

**Why.** The new command was inserted by a script whose string escapes turned the newline escapes in two template literals into real line breaks.

**Result.** The two literals were fixed by hand and the command ran; `tsc` and biome passed after.

**Consequence.** Edits to source go through the editor, not through generated string replacement.
