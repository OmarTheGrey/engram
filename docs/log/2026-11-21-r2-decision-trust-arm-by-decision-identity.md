---
date: 2026-11-21
author: claude-agent
type: decision
card: R2
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - docs/decisions/0040-trust-floors.md
  - packages/bench/src/gatemem/plane.ts
  - packages/bench/src/longmemeval/plane.ts
  - packages/bench/src/mem-inv-bench/plane.ts
supersedes: none
---

**What.** The trust-floor proposal (P7) compares medium with medium plus the two trust options, and it proposes no live sessions. Its main part replays each recorded run's events under the trust preset and compares every write and read decision.

**Why.** The three benchmark harnesses attest a source on every write, so the floor should not bite there. A live arm would most likely measure C5 against itself, as C7 did. Varying only the two options isolates them, even if card E2.11's preset differs from medium elsewhere.

**Result.** Under C5, identical decisions imply identical model requests. A difference on a registered benchmark goes to the lead under ADR 0040, decision 8.

**Consequence.** If replay finds no difference, the trust preset is proven to leave H1 and H2 as they are. If it finds one, the lead decides before any registration.
