---
date: 2026-11-21
author: claude-agent
type: change
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/verify.ts
  - packages/core/src/log/chain.ts
  - packages/core/test/unit/log/attacks.test.ts
  - packages/core/test/property/chain.test.ts
supersedes: docs/log/2026-11-21-e1-6-change-verifier-checkpoints.md
---

**What.** The review fix pass of card E1.6: the eleven findings E1.6-1 to E1.6-11 fixed, with the reviewer's attacks ported as tests that failed before their fixes (17 of 32 red).

**Why.** The review forged two tampered logs that verified OK and found ten of thirteen verifier mutants surviving.

**Result.** Checkpoints sign only over a log that verifies under the pinned key and every held checkpoint; manifests must name erase events of their items; OK needs a pinned signed checkpoint covering the whole chain; crafted rows fail with a named link; links take a 0x02 prefix; the note parser is strict; the shared opener keeps the chain. The property names the check catching each of 26 tampers. Mutants: the review's 14 and 11 new, all 25 killed.

**Consequence.** The mutant script is scratchpad e16-fix-mutate.py; its run is quoted in PR.md.
