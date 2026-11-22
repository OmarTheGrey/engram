---
date: 2026-11-21
author: claude-agent
type: change
card: X14
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/PINS.md
  - packages/bench/src/redteam/payloads.ts
  - docs/deps.md
  - "make test-one T=packages/bench/test/redteam/payloads.test.ts"
supersedes: none
---

**What.** Card X14 pinned two payload sets in `packages/bench/PINS.md`, in a new section for unregistered data, and added hyparquet 1.32.0 (MIT) to `packages/bench` to read them.

**Why.** Proposal P1 names `deepset/prompt-injections` and `Lakera/gandalf_ignore_instructions` as payloads; a result built on them must name exact revisions and bytes.

**Result.** Before: no payload pin. After: deepset at `4f61ecb038e9c3fb77e21034b22511b523772cdd` (card states apache-2.0, and cc-by-4.0 in dataset_info; 662 rows, 263 labelled injection) and Lakera at `04737b65e90a6794ec227012e4a255a7def6344b` (MIT; 1,000 rows), each Parquet file with its sha256, fetched into `.engram/upstream/` and never committed. A fetch is refused under `ENGRAM_OFFLINE=1`, and a file whose bytes differ is refused; the payloads test (5 tests) passes.

**Consequence.** Registering P1 makes these pins subject to rule 8 like the benchmark table.
