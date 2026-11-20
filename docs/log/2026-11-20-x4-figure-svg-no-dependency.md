---
date: 2026-11-20
author: claude-agent
type: decision
card: X4
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/scripts/h1_figure.py
  - research/pyproject.toml
supersedes: none
---

**What.** H1's figure is SVG written by hand in `research/scripts/h1_figure.py`, saved as `research/results/h1-figure.svg`, not a matplotlib PNG at `results/h1.png` as card X4's acceptance says.

**Why.** matplotlib is not a dependency. A PNG's bytes depend on the rasteriser, the font files installed and the library version, so rule 9's sha256 check would need all three pinned. Hand-written SVG is byte-stable by construction and needs no new dependency.

**Result.** No dependency added; `docs/deps.md` is unchanged. The name follows the pre-registration's `research/results/h1-*`. The SVG names a font stack, so how it looks can vary between viewers while its bytes cannot. Cost if wrong: if the thesis needs a PNG or PDF, a conversion step is added after the SVG, and the SVG stays the rule-9 result.

**Consequence.** The thesis embeds the SVG, or a conversion of it.
