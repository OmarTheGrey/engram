---
date: 2026-11-28
author: claude-agent
type: change
card: X17
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/results_page.py
  - research/tests/test_results_page.py
  - research/configs/results-register.json
  - docs/research/results.html
  - "make results-page CHECK=1"
supersedes: none
---

**What.** The review's fixes: main merged with E2.18's Cedar proof of concept given a title and meter; the page refuses a hypothesis result citing a proposed arm or serving no hypothesis.

**Why.** The Cedar row had no title, so the page refused it after the merge; and the card's risk, a proposed arm's number shown as a result, was only badged, not refused.

**Result.** The Cedar section reads "31 of 31 properties proved or refuted as expected" from its file. The title refusal names the register's config and `make results-page`; the register's docstring states the page's requirements. Headings go h2, h3, h4 without a skip; bars are `aria-hidden`, their text kept; key paths wrap at dots; the figure panel uses theme tokens. Disabling the proposed-arm refusal fails a test.

**Consequence.** Correcting `2026-11-28-x17-change-results-page.md`: two of the five exploratory rows serve H3 and sit under H3, not under the other checks.
