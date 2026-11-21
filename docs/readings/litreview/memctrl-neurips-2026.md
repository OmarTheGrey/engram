---
id: memctrl-neurips-2026
title: "MemCtrl: Do users have control over their agent's memory?"
authors: Tong, Zhang, Shafran, Tramer, Shokri
venue: NeurIPS 2026 workshop Agents in the Wild (poster)
year: 2026
tier: new
topics: [twin, benchmark, governance, evaluation]
engram: [twin, govern, H1]
code: none found
sources_read: [https://neurips.cc/virtual/2026/168268]
---

## Claim
No tested memory system reliably follows all three user memory-control instructions: Incognito (do not store), Forget (remove), Withhold (disregard for now). High utility tends to coincide with high violation.

## Method
A benchmark built from observed ChatGPT requests to remove or disregard information; five memory systems and two production chatbots evaluated; violations traced to four failure levels and distilled into design guidelines. The page does not describe construction in more detail.

## Key numbers
- ChatGPT and Claude surface restricted information in 77.4 to 83.3 percent of controlled cases on average (event page).
- 5 systems, 2 chatbots, 3 settings, 4 failure levels.

## What Engram borrows
The three instructions as Twin verbs with different enforcement points: Incognito is a write-gate rule (deny), Forget is erase, Withhold is a temporary read-filter suppression with an expiry. Candidate policy rules and a Twin benchmark arm (AB-TWN-2 scope plus an H1 extension).

## What Engram does differently
Engram enforces at the write gate and read filter by construction, not by model compliance; a violation is a logged decision rather than a model behaviour.

## Risk to our claims
Withhold has no schema field today; claiming Twin supports user control is incomplete without it.

## Open question
Is Withhold a grant with negative effect, or a retire with an expiry and automatic reinstate?

## Notes
Only the event page was read, not the paper; an OpenReview link is given there.
