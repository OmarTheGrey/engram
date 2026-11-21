---
date: 2026-11-21
author: claude-agent
type: failure
card: R3
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - https://arxiv.org/pdf/2611.20144
  - https://arxiv.org/pdf/2610.22959
  - docs/research/positioning.md
supersedes: none
---

**What.** Three tables could not be read reliably, and part of HEAMS's appendix was skimmed rather than read.

**Why.** arXiv's HTML page for SAFE-Mem held no paper text, so both papers were read as text extracted from their PDFs (`pdftotext -layout`), which lost the column alignment of HEAMS Tables 4 and 6 and SAFE-Mem Table 2. HEAMS has 69 pages; the tables of Appendices C.1 and C.3 and the prompts of D.1 and D.3 were skimmed.

**Result.** No number in `docs/research/positioning.md` or this card's log entries comes from those three tables unless the paper's prose states it too; SAFE-Mem's EHRAgent results are taken from its Sec. 5.3 text. Nothing in the skimmed parts is cited.

**Consequence.** A reader who needs a number from those tables reads the PDF itself.
