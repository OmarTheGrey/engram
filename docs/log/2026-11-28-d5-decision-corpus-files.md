---
date: 2026-11-28
author: claude-agent
type: decision
card: D5
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - packages/core/scripts/procedural-corpus.ts
  - packages/core/scripts/faults.ts
  - fixtures/faults/procedural/corpus.json
  - Makefile
supersedes: none
---

**What.** The corpus is declared in `packages/core/scripts/procedural-corpus.ts` and written by `faults.ts` into `fixtures/faults/procedural/corpus.json`, two files outside the card's list; the result is `h5-procedure-scan.json`.

**Why.** `make fixtures` deletes `fixtures/faults` and regenerates it from `faults.ts`, so a hand-written file there would vanish, and the testing convention requires golden files written by a command. H5 (Distill) is the nearest hypothesis; the result decides none.

**Result.** Regenerating the catalogue into a temporary folder gives every committed file byte for byte, the corpus included; a test holds the committed corpus to `corpusText()`.

**Consequence.** None for other fixtures: no file under `fixtures/faults` other than the new one changed.
