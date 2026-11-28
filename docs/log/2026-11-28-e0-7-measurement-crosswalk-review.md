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
supersedes: docs/log/2026-11-28-e0-7-measurement-crosswalk.md
---

**What.** The unregistered `research/results/h1-crosswalk.json` row moved a second time in card E0.7's PR, after its review: C44 cites the rule's line-pin test under its new name and its limits cell names what the text rule cannot see.

**Why.** Rule 9. The review (finding 6) noted the test name pointed at line numbers C44 no longer stated, and (finding 2) that the limits named only computed property names.

**Result.** A support artefact, not a hypothesis result. The script printed "crosswalk: 50 claims, 47 evidenced by 107 tests in 33 files, 3 not evidenced, 27 obligations", counts unchanged. New sha256 `b3e535e503dc1e2944302b3f09b0a4a27f367ac87e6e53d465cf7e6189db47dd`, MANIFEST commit e2d67cd; `scripts.reproduce.check_row` on the row returns no problems.

**Consequence.** The results register is regenerated from it.
