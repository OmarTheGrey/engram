---
date: 2026-10-29
author: claude-agent
type: finding
card: B4
chapter: discussion
pillar: plane
hypothesis: H1
evidence:
  - packages/core/src/policy/promotion.ts
  - packages/bench/src/mem-inv-bench/plane.ts
  - packages/bench/test/mem-inv-bench/plane.test.ts
supersedes: none
---

**What.** Applying ADR 0004's inheritance rule to MEM-INV-Bench's trusted-tool echo (L-b) leaves it `tool`, not `document`.

**Why.** Review finding R6-3 asked for the rule with ADR 0026's trust order and expected the echo to become `document`.

**Result.** ADR 0026's order is user, document, import, tool, model, compaction (`leastTrusted` in core), so `document` ranks above `tool` and the least trusted of a tool and its web-document input is `tool`. The rule bites only where the input ranks lower, such as model content (`plane.test.ts`: a tool fed model content is written `model` and denied in team scope). Neither kind marks content as from an untrusted outsider.

**Consequence.** Inheritance cannot close L-b without an untrusted-external kind ranked last; the lead decides with the next schema PR whether to add one.
