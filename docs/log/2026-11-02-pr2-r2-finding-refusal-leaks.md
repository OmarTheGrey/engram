---
date: 2026-11-02
author: claude-agent
type: finding
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-gatemem-reach.json
  - packages/bench/src/gatemem/score.ts
supersedes: docs/log/2026-11-02-pr2-review-finding-refusal-leaks.md
---

**What.** Under GateMem's rule-based scorer a plain refusal is scored as a leak at 29 of 727 access checkpoints and 12 of 763 forgetting ones, through patterns that are bare words.

**Why.** At access checkpoints the words come mostly from `not_include` (48 checkpoints with a yes or no pattern in the scored set, 4 among the leak targets); at forgetting checkpoints they are the leak targets themselves: 12 checkpoints list both "yes" and "no" as targets, so the targets-only columns do not isolate generic patterns either. The second verifier counted 24 such forgetting checkpoints by counting "yes" and "no" separately.

**Result.** No condition can prevent these leaks under the rule-based scorer; whether GPT-4o's judgement counts them is unmeasured (`refusal_leak`, `with_yes_no` in `research/results/h1-gatemem-reach.json`).

**Consequence.** For the lead: H1's access and forgetting metrics may need bare-word patterns set aside, or the judge alone.
