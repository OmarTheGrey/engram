---
date: 2026-11-19
author: claude-agent
type: decision
card: RV2
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/scripts/h1-sessions.ts
supersedes: docs/log/2026-11-19-rv2-decision-reader-template.md
---

**What.** `make h1-table` writes one template per reader, `.engram/runs/h1-unread-reader1.json` and `h1-unread-reader2.json`, each with its pseudonymous id filled in. The blind join and `h1-readings/1` both accept exactly `reader1` and `reader2`.

**Why.** RV2-1 and RV2-6. The readings will be committed, so they must carry no name. Of the reviewer's two options, a pre-filled id leaves the reader nothing to type, which suits the blind kit better than an instruction to choose a pseudonym. Restricting `h1-readings/1` the same way keeps both paths to committed readings name-free.

**Result.** The two templates differ only in `reader`. Every path the converter writes is guarded against `--readings`. Both id checks are mutation-tested.

**Consequence.** If wrong, a third reader would need a code change. The plan names two readers.
