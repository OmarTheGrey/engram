---
date: 2026-11-19
author: omar
type: decision
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/README.md
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
  - docs/decisions/0032-simulator-replays-recorded-calls.md
  - docs/decisions/0033-shared-model-package.md
  - docs/decisions/0009-retrieval-explanations.md
  - docs/decisions/0018-duplicates-without-embeddings.md
  - docs/tasks/backlog.md
supersedes: none
---

**What.** The lead accepted ADRs 0031, 0032 and 0033 as written and is their decider, with the amendments that awaited him: ADR 0009's of 2026-11-02, ADR 0018's of card L1 (2026-11-06), those of 2026-11-13 to ADRs 0001, 0009 (both), 0010, 0021 and 0032, and ADR 0025's corrected amendment sentence.

**Why.** He took every recommendation of the pre-registration's decision sheet on 2026-11-19 but three; item 6 recommends ADR 0009's amendment and ADR 0031, and the backlog row "ADRs for the lead" named the rest.

**Result.** Each ADR's status reads accepted, 2026-11-19, its deciders line names the lead, and each amendment says it was accepted that day. The backlog row is closed, and `OWNER_DECIDES` in `scripts/test/tasks-and-decisions.test.ts` is empty.

**Consequence.** All 33 ADRs bind; changing one takes a new ADR or an amendment with its own `decision` entry.
