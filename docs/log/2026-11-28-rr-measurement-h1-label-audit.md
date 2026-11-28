---
date: 2026-11-28
author: claude-agent
type: measurement
card: none
chapter: results
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-label-audit.json
  - research/configs/label-audit.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/label_audit_draw.py --config research/configs/label-audit.json --out research/results/h1-label-audit.json"
supersedes: docs/log/2026-11-26-r5-measurement-h1-audit-draw.md
---

**What.** H1's label audit draw record under `on_stop` "drop", MANIFEST row `research/results/h1-label-audit.json`, restated with its config `research/configs/label-audit.json` as evidence.

**Why.** Card R5's entry named the config only inside its command, which the thesis consolidator rejects; its numbers still match the file.

**Result.** A pre-registration support artefact: the items H1's three members audit, not a hypothesis result. GateMem: `benchmarks.gatemem.items` 50, `benchmarks.gatemem.stop_at_rejected` 6. MEM-INV-Bench: `benchmarks.mem-inv-bench.items` 38, `benchmarks.mem-inv-bench.stop_at_rejected` 4. `seed` 20261103, `reject_quorum` 2, `stop_share` 0.1, `on_stop` "drop". The committed file hashes to the MANIFEST's sha256; with `on_stop` set back to "pause" it hashes to the row R5 replaced, so no item, id, order or stop moved.

**Consequence.** `make test-repro` checks the row.
