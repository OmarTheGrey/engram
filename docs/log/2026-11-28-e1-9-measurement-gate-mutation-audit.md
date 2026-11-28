---
date: 2026-11-28
author: claude-agent
type: measurement
card: E1.9
chapter: results
pillar: plane
hypothesis: none
evidence:
  - research/results/h1-gate-mutation-audit.json
  - research/configs/gate-mutation-audit.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/gate_mutation_audit.py --config research/configs/gate-mutation-audit.json --out research/results/h1-gate-mutation-audit.json"
supersedes: docs/log/2026-11-28-x16-measurement-audit-after-review.md
---

**What.** Card X16's audit was rerun on this branch with chain version 2 and regenerated; MANIFEST row `research/results/h1-gate-mutation-audit.json`, commit 3c10ab53, sha256 6afe298f... (was 8e61f235...).

**Why.** The orchestrator's decision: an unregistered proof of concept on the code's own tests, never a hypothesis result, that moved for a reason this card causes.

**Result.** Unchanged verdicts: 32 of 34 mutants killed (kill rate 0.941176), survivors `I1-status-ignored` and `I1H-store-delete-skipped`. Two `killed_by` messages moved: `I9-commitment-ignores-value`'s now lists the new `attestations` check among the checks it prints; `I9-link-ignores-previous`'s quotes other genesis hashes, because a new genesis says version 2. Neither mutated line of chain.ts changed.

**Consequence.** The results register and the results page were regenerated. Rerun once more after the review fix pass and the merge of main at 3de59028: the same bytes, 6afe298f...
