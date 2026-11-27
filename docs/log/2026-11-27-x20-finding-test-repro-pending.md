---
date: 2026-11-27
author: claude-agent
type: finding
card: X20
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/log/2026-11-26-x20-failure-test-repro-timeout.md
  - research/results/MANIFEST.md
supersedes: none
---

**What.** No passing `make test-repro` is recorded for X20. The failure entry `2026-11-26-x20-failure-test-repro-timeout.md` says the rerun is "in the report and PR.md". That rerun was never logged, and PR.md is not committed.

**Why.** The final review's finding 8. The fix pass of 2026-11-27 does not run `make test-repro`, because the orchestrator runs it serially before the merge to keep load off the shared machine.

**Result.** The only evidence on the branch is the first run's ten matching rows out of 25. No MANIFEST row, fixture or cassette is touched by the branch (`git diff origin/main...HEAD --stat` names none).

**Consequence.** The orchestrator's serial `make test-repro` at the final head is the acceptance evidence. It goes in a measurement entry that names the head, the rows reproduced and the worker count.
