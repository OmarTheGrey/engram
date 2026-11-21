---
date: 2026-11-21
author: claude-agent
type: decision
card: R3
chapter: design
pillar: research
hypothesis: none
evidence:
  - README.md
  - docs/architecture.md
supersedes: none
---

**What.** The claim was added as one new paragraph in `README.md` and one in `docs/architecture.md`, rather than by rewriting existing sentences.

**Why.** The card asks to restate the claim where it appears, and another agent is overhauling the README, so only claim sentences may change there. Neither file had a sentence stating what is new (the grep of `docs/log/2026-11-21-r3-claim-restated.md`), so there was nothing to rewrite.

**Result.** Each file gained one paragraph after its opening description; no other line changed.

**Consequence.** If wrong, the cost is a paragraph the README overhaul has to place; it merges as a pure addition.
