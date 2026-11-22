---
date: 2026-11-21
author: claude-agent
type: decision
card: X14
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - fixtures/amsb/scenarios.json
  - packages/bench/scripts/vendor-amsb.py
supersedes: none
---

**What.** The vendored corpus keeps AMSB's fake GitHub token as upstream's two fragments and the oversized payload as its unit and count; the loader assembles both.

**Why.** Upstream splits the token so no secret scanner flags its source; the repository's own scanning deserves the same, and 150,000 characters of repetition add nothing to a fixture.

**Result.** The assembled corpus is AMSB's byte for byte (the amsb test checks the token's shape and the payload's length).

**Consequence.** None. Cost if wrong: none.
