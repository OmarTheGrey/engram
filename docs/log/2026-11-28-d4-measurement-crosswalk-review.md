---
date: 2026-11-28
author: claude-agent
type: measurement
card: D4
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h1-crosswalk.json
  - research/configs/crosswalk.json
  - research/results/MANIFEST.md
  - docs/compliance/README.md
  - "uv run python research/scripts/crosswalk.py --config research/configs/crosswalk.json --out research/results/h1-crosswalk.json --table docs/compliance/README.md"
supersedes: docs/log/2026-11-28-d4-measurement-crosswalk.md
---

**What.** The unregistered `research/results/h1-crosswalk.json` row moved a second time in card D4's PR, after its review: claim C48 now says a restore needs the floor and the promotion gate, cites ADR 0050, and states its limits.

**Why.** Review finding 9: C48 said "passes the admission rule", where the code also requires the floor and now the whole promotion gate, and it had no limits cell for the presented outcomes and the absent surface.

**Result.** A support artefact, not a hypothesis result. The script printed "crosswalk: 51 claims, 48 evidenced by 111 tests in 34 files, 3 not evidenced, 27 obligations", counts unchanged. New sha256 `8fad8887689f03215a3327475415bcd2cfedfc8f68aa8d184b27af96954434ac`, MANIFEST commit 4207427.

**Consequence.** The results register and page are regenerated from it.
