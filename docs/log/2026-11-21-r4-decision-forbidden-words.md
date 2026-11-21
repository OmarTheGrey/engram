---
date: 2026-11-21
author: claude-agent
type: decision
card: R4
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/scripts/crosswalk.py
  - research/tests/test_crosswalk.py
supersedes: none
---

**What.** The wording ban is a whole-word, any-case match of satisf-, comply, complies, complied, complying, compliant, compliance, conform, conforms, conformed, conforming, conformity, meet, meets, met, discharg- and fulfil-, over each row's own text, the config's statement and method, and the README outside the generated table, apart from listed negations (`NEGATIONS`).

**Why.** The review evaded the old substring list with ordinary inflections. Whole words keep "conformance" (the adapter suite), "meeting", "metadata" and "method" usable; "met" is matched as a word, since "the obligation is met" is the use to refuse. Quotations and test titles are exempt: they are the acts' and the code's words.

**Result.** Each stem is refused and each ordinary word passes, in tests. The README needed its heading renamed and two sentences reworded.

**Consequence.** A new negation must be added to `NEGATIONS` in review.
