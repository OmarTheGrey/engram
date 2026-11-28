---
date: 2026-11-28
author: claude-agent
type: milestone
card: none
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - docs/log/2026-11-27-x20-measurement-test-repro-at-head.md
  - "make test-repro"
supersedes: none
---

**What.** All 24 rows of `research/results/MANIFEST.md` reproduce byte for byte on main's code as of 2026-11-28.

**Why.** The results register and the thesis drafts cite these files, so each must still regenerate from its script and config before H1's live runs of 1 to 8 December.

**Result.** `make test-repro` passed at X20's head a553b311 (`docs/log/2026-11-27-x20-measurement-test-repro-at-head.md`) and again at RD1's merged head 42131029: every row's sha256 matches. Main's b30cdffd differs from 42131029 in two test files and two log entries, no research script, config or result. `h1-redteam.json` needs its two pinned payload sets in `.engram/upstream`; `h2-frontier-axes.json` takes about 2 hours on 4 workers. Every committed result is a fixture-size measurement, a cost or power computation, a reach measurement or a pre-registration support artefact; no hypothesis has a live result yet.

**Consequence.** The register in `docs/research/results.md` is built on these 24 files.
