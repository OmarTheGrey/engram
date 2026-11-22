---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/chain.test.ts
supersedes: none
---

**What.** Two template strings in the chain property lost their ${} when the tamper section was spliced in (d99af41d): the genesis-respelled tamper wrote literal text, and seedFor received a literal, so both backends ran one seed.

**Why.** Verification finding E1.6-13; how the braces went missing in that splice is not established.

**Result.** Both are restored. The respelled genesis is valid JSON again, so only the canonical-text rule catches it (the reviewer's genesis mutant is killed); each backend runs its own seed again, and both pass.

**Consequence.** Tamper code is grepped for `$` without a brace before commit.
