---
date: 2026-11-19
author: claude-agent
type: failure
card: L4
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-lint-floor.json
supersedes: none
---

**What.** Review finding L4-6: the PR body and `finding-by-construction` said no deterministic lint reads text, which is wrong: the duplicate lint compares content hashes.

**Why.** A shortening of the result's own sentence.

**Result.** Both now use the result's wording: no deterministic lint is built for what makes an unkeyed item faulty, which is in its text only.

**Consequence.** None beyond the wording.
