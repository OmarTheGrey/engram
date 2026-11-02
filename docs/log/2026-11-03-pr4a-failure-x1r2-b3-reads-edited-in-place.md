---
date: 2026-11-03
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/log/2026-11-02-x1r2-b3-reads.md
  - docs/log/2026-11-02-x1r3-failure-local-evidence-path.md
  - "git diff 095ee5d 756096d -- docs/log/2026-11-02-x1r2-b3-reads.md"
supersedes: none
---

**What.** `docs/log/2026-11-02-x1r2-b3-reads.md` was edited in place by PR #25's commit `756096d`, although entries are immutable (documentation convention, rule 5).

**Why.** Its evidence named `.engram/runs/b3-gatemem-plane/results.jsonl`, a run output git ignores, so CI's `make lint-docs` and `make thesis` failed on PR #25 (`2026-11-02-x1r3-failure-local-evidence-path`). The entry was not yet merged, and a superseding entry would have left the failing one in the tree, still failing the check.

**Result.** The edit changed the evidence to the committed cassettes, the config and the replay command, and the Result's first words from "Recorded by `make fixtures`" to "Replayed from the committed cassettes by the command above"; its numbers did not change. The PR 3 verifier's N-3 asked for this note.

**Consequence.** An unmerged entry whose evidence cannot exist may be corrected in place, and the correction is logged like this; a merged entry is superseded.
