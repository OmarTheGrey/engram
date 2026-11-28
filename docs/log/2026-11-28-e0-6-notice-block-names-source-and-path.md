---
date: 2026-11-28
author: claude-agent
type: decision
card: E0.6
chapter: design
pillar: research
hypothesis: none
evidence:
  - scripts/check-absorbed.ts
  - NOTICE
supersedes: none
---

**What.** A copy's NOTICE entry counts only when one block of `NOTICE` (between rule lines of dashes) names the row's `owner/repo` and one of its landed paths, each whole, case folded.

**Why.** The source alone would pass a second copy from a project already in NOTICE for another file (Remnic and Claude-Mem each appear twice). A substring would let `o/r-fork` stand for `o/r` and `a/b.ts.bak` for `a/b.ts`, so names match on boundaries: a repository may follow a slash (`github.com/`), a path may not, and either may be followed by a slash or closing punctuation.

**Result.** All thirteen copy rows of main's register pass. Accepted limit: every backticked path in the landed cell counts, so a block naming only the test file or a folder that reads the data satisfies it.

**Consequence.** A card copying from a project already in NOTICE names its own file in that block.
