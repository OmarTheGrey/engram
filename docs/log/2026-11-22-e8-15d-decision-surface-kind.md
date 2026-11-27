---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15d
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/keys.ts
  - packages/cli/src/tui/screen.ts
  - packages/cli/test/tui/keys.test.ts
supersedes: none
---

**What.** The hand-made screens are one new screen kind, `surface`, with a block of its own in the key table: v plain, J JSON, r run again, s stop, o copy the inspector's address, k keys, n new key, R revoke, t Try it, a all rows, pgup and pgdn; tab wraps around, the arrows stop at the ends; a screen names the actions it takes, and the help overlay lists only those.

**Why.** On one kind a key may have one meaning (docs/design/tui.md 9.1, and keys.test.ts checks it), so Keys' revoke cannot be the mockup's `r`, which is "run again" on the same kind; R, a capital for a change that cannot be undone, is free. Their own kind keeps E8.15c's and the generated form's keys apart.

**Result.** keys.test.ts passes: no key bound twice on any kind.

**Consequence.** If wrong, a key table per screen replaces it.
