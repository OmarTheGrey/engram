---
date: 2026-11-21
author: claude-agent
type: decision
card: L5
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/lint/near-duplicate.ts
  - packages/core/test/unit/lint/near-duplicate.test.ts
supersedes: none
---

**What.** Text under 32 words is shingled into character 3-grams, from 32 words into word 2-grams; a pair is compared by the kind of its shorter text, and a text is indexed for each kind a pair of it could reach the threshold in.

**Why.** The card asks for word shingles with character shingles below a length floor. Word 2-grams drop a one-word insertion in a ten-word sentence to 0.73, character 3-grams keep it near 0.9 and still separate a subject and object swap (0.64).

**Result.** From 32 words a one-word insertion keeps word 2-gram similarity at (n-2)/(n+1), 0.91 or more. A pair straddling the floor is compared by characters. Cost if wrong: recall on mid-length restatements.

**Consequence.** Arm P4 sets its threshold on the catalogue before natural memory, as registered.
