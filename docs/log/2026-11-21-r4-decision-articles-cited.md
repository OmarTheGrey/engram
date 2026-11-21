---
date: 2026-11-21
author: claude-agent
type: decision
card: R4
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/absorb/13-compliance.md
  - docs/compliance/README.md
supersedes: none
---

**What.** Of the articles the research note's plan AB-CMP-5 listed, AI Act Articles 10 and 50 and GDPR Articles 20 and 35 are not cited; AI Act 13(3)(b)(iv), 15(1), 15(5) and 26(5) and GDPR 5(1)(d), 5(1)(f), 5(2), 7(1), 7(3), 24(1), 32(1)(b) and 32(1)(d) are added.

**Why.** Read in the primary text, Article 10 governs training, validation and testing data sets, which agent memory is not; Article 50's duties (telling people they interact with an AI system, marking generated content) are not the plane's. No export or impact-assessment output exists, so no claim bears on GDPR 20 or 35. The added paragraphs are the ones the claims bear on. ISO/IEC 42001, NIST and SOC 2 stay out: the card cites the two acts only.

**Result.** 27 obligations, listed with reasons in `docs/compliance/README.md`.

**Consequence.** If a subject export (plan AB-CMP-7) lands, GDPR 15 and 20 rows follow.
