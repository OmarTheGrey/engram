---
date: 2026-11-28
author: claude-agent
type: decision
card: L9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/evidence.ts
  - packages/core/test/unit/lint/evidence.test.ts
supersedes: none
---

**What.** Before matching, curly single and double quotes, primes, the hyphen and dash variants and the minus sign fold to their ASCII forms, on both the quote and the item; letter case does not fold.

**Why.** Review finding L9-2: a model writing ' for a curly apostrophe, or - for a non-breaking hyphen, would be ungrounded for a typographic difference, a recall cost with real models that carries no evidence. The source matches them as written; the divergence is stated in the file's header.

**Result.** Tested both ways. The fold changes no row of the fixture run, whose texts are ASCII.

**Consequence.** Case and other punctuation differences still fail, a known recall cost for any live pilot of the option.
