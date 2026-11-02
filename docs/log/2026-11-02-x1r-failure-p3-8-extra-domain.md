---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/bench/test/gatemem/pinned.test.ts
supersedes: none
---

**What.** `checkGateMemData` called a directory the full set when the eight pinned files matched, though the loader also loads any other domain directory beside them.

**Why.** The check hashed the pinned files and ignored what else the folder held.

**Result.** It now requires exactly the four pinned domains (and the fixture's own domains for the subset); tests add a fifth directory.

**Consequence.** Found by the independent review of PR #25 and fixed in its review fix pass.
