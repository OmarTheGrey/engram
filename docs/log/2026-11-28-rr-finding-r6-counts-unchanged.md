---
date: 2026-11-28
author: claude-agent
type: finding
card: R6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-gatemem.json
  - research/configs/h1-mem-inv.json
  - docs/log/2026-11-27-r6-measurement-counts-unchanged.md
  - "make run CONFIG=research/configs/h1-gatemem.json COUNT=1"
supersedes: docs/log/2026-11-27-r6-measurement-counts-unchanged.md
---

**What.** Card R6's two COUNT=1 comparisons, restated as a finding: a session count from the runner, not a MANIFEST result.

**Why.** Typed as a measurement with no results file under `research/results/`, the entry made `make thesis` fail.

**Result.** As the superseded entry records, each config's `count.json` was byte identical on R6's branch and on `origin/main`: `h1-gatemem` 26,616 sessions, 6,654 per condition (sha256 `aa7fd0b7...faa7`); `h1-mem-inv` 456 sessions, 114 per condition (sha256 `943c8816...4569`), the hashes the PR recorded on 2026-11-26.

**Consequence.** The pin is part of no count; the test-repro part of R6's acceptance was run at X20's head (`docs/log/2026-11-27-x20-measurement-test-repro-at-head.md`).
