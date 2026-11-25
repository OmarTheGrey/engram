---
date: 2026-11-25
author: claude-agent
type: finding
card: none
chapter: related-work
pillar: research
hypothesis: none
evidence:
  - docs/tasks/absorb-plan-2.md
  - gh api repos/modelcontextprotocol/servers/contents/LICENSE
supersedes: none
---

**What.** Five premises about sources changed since 2026-11-21: one licence and four repository names, and one pin.

**Why.** Every source was rechecked with `gh api` and crates.io on 2026-11-25.

**Result.** `modelcontextprotocol/servers` reports NOASSERTION: its LICENSE is a transition from MIT to Apache-2.0, both allowed. `caura-ai/caura-memclaw` redirects to `caura-ai/caura`, `informalsystems/quint` to `quint-co/quint`, `secure-systems-lab/dsse` to `dsse-lf/dsse`. `cedar-policy-symcc` 0.9.0 is from 16 November, under two weeks old, so 0.8.1 is the pin.

**Consequence.** Cards A6, D5, E2.17, E1.8, E9.15 and E2.18 name the current names and commits.
