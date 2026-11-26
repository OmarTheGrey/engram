---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15b
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/home.ts
supersedes: none
---

**What.** A Home letter opens its command at once, letters are shown in brackets in every mode rather than underlined, and the seven commands the mockups give no letter take o, C, E, u, F, A and R.

**Why.** The mockups' hint reads "letter action" and the strip says "d" runs doctor; brackets read the same in no colour, ASCII and to a screen reader.

**Result.** keys.test.ts holds every letter unique and clear of the global and list keys.

**Consequence.** If wrong, letters only select, a change local to home.ts.
