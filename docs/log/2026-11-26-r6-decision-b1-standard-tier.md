---
date: 2026-11-26
author: claude-agent
type: decision
card: R6
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/configs/openrouter-endpoints.json
  - research/configs/b1-gatemem-reference.json
supersedes: none
---

**What.** B1's `openrouter/openai/gpt-5.4` is pinned to OpenAI's standard endpoint, tag `openai`, among the three OpenAI lists of its own (`openai`, `openai/flex`, `openai/fast`).

**Why.** The rule names the maker's endpoint and leaves the tier open. B1 compares against the paper's GPT-5.4 row, run on OpenAI's standard API; the flex tier trades latency and availability for price, and fast is the priority tier at twice the price. All three honour `seed`.

**Result.** 2.5 dollars in and 15 out per million on the day fetched; B1's ceiling (10 ledger dollars) is unchanged.

**Consequence.** If wrong, the flex tier would have cost half as much; a pin is one config change.
