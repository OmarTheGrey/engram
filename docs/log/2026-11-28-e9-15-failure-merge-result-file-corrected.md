---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.15
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/results/h1-gate-mutation-audit.json
supersedes: docs/log/2026-11-28-e9-15-failure-merge-result-file.md
---

**What.** A correction of the earlier entry on the gate mutation audit's row: it named the wrong cause and the wrong main.

**Why.** The review found that the first merge (17f1a2fb, of main through #157) resolved that MANIFEST row to one from a later main (#158, card E1.9), in neither parent; the follow-up commit then took the result file from that later main to match it, so the branch carried E1.9's result without E1.9's code.

**Result.** Main was merged twice more (through #164); the row and the file are now main's (commit 50e3a293, sha256 842da604...0107), and the only result files differing from main are this card's row and `h1-audit-report.json`.

**Consequence.** Check a merge's MANIFEST rows against both parents, not only for duplicates.
