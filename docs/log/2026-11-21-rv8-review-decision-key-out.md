---
date: 2026-11-21
author: claude-agent
type: decision
card: RV8
chapter: design
pillar: research
hypothesis: H2
evidence:
  - research/scripts/label_audit_draw.py
  - research/tests/test_label_audit.py
supersedes: none
---

**What.** The draw script no longer records counts per kind; `--key-out` writes them to a key under `.engram/` or outside the repository.

**Why.** The counts help whoever runs the audit and harm the members, so they live where the sheets live, never in `research/results/`.

**Result.** `compute_key` returns them and `check_out_dir` refuses a key inside the repository outside `.engram/`. Tests: the committed record holds no `by_kind`, the key does, a key path under `research/` is refused. The older entries, on the unmerged branch, were edited in place.

**Consequence.** The key is not reproduced by `make test-repro`; rerun the draw with `--key-out` for it.
