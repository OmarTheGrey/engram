---
date: 2026-11-28
author: claude-agent
type: measurement
card: E0.7
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h1-crosswalk.json
  - research/configs/crosswalk.json
  - research/results/MANIFEST.md
  - docs/compliance/README.md
  - scripts/test/core-determinism-rule.test.ts
  - "uv run python research/scripts/crosswalk.py --config research/configs/crosswalk.json --out research/results/h1-crosswalk.json --table docs/compliance/README.md"
supersedes: docs/log/2026-11-21-r4-measurement-crosswalk-fix-pass.md
---

**What.** Crosswalk claim C44 (injected time, no randomness in core) now names two tests of the core determinism rule, and the unregistered `research/results/h1-crosswalk.json` row moved, as `docs/tasks/absorb-plan-2.md` section 5 sanctions for this card.

**Why.** Rule 9; the lead moved the card's after-the-tag step before the tag (`docs/tasks/lead-decisions.md`).

**Result.** A support artefact, not a hypothesis result. The script printed "crosswalk: 50 claims, 47 evidenced by 107 tests in 33 files, 3 not evidenced, 27 obligations" (before: 46, 105, 32, 4). Not evidenced: C30, C48, C50. New sha256 `03361028b83fbd4e1b316423bbddb041a6f39aea58fe59b9a3fefe5b48bebd4b`, MANIFEST commit 76b8bb7. `scripts.reproduce.check_row` on the row returns no problems.

**Consequence.** C44 carries a limits cell: the rule reads source text and does not show each surface passes the time it was given.
