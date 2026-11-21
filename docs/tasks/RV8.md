# RV8 The research half of the design review: LongMemEval's label audit, the full cost table, the frontier axes offline

Status: done on branch rv8, awaiting review. Paths used: `research/scripts/label_audit_sample.py`, `research/scripts/label_audit_agreement.py`, `research/scripts/label_audit_draw.py` (new), `research/configs/label-audit.json`, `research/configs/label-audit-longmemeval.json` (new), `research/results/h1-label-audit.json` and `h2-label-audit-longmemeval.json` (new), `research/scripts/cost_table.py`, `research/configs/cost-table.json`, `research/configs/openrouter-prices.json` (second fetch of 2026-11-20, GLM 5.3 Flash added), `research/results/h2-cost-table.json` (new), `research/scripts/frontier_axes.py`, `research/configs/frontier-axes.json`, `research/results/h2-frontier-axes.json`, `packages/runner/scripts/frontier-axes.ts` (new), `packages/runner/src/research/longmemeval-clock.ts` (`clockRowFor`), `research/tests/test_label_audit.py`, `research/tests/test_cost_table.py` and `test_frontier_axes.py` (new), `research/results/MANIFEST.md`, `docs/research/label-audit.md`.

From the design-gap review on main `00c606e` (findings RV-DES-2, RV-DES-17 and RV-DES-20). Its results inform lead-decisions items 1, 2, 3, 21 and 47 (`docs/tasks/lead-decisions.md`), and the audit kit is needed before the label audit of 23 to 28 November.

Goal:

1. **RV-DES-17.** LongMemEval gets the label-audit kit GateMem and MEM-INV-Bench have: three members, one template each, a seeded sample of the size the pre-registration registers, and one agreement and stop computation for every benchmark. The rejection quorum and the response to a stop are config values (items 5 and 6 are pending).
2. **RV-DES-20.** One cost table over every registered run, H1 to H5: calls, prompt and completion tokens, dollars on each model option of item 1 at prices from a config naming its source and date, the RV1 ceiling (1.25 times the high estimate) per run, and the totals for items 2 and 47.
3. **RV-DES-2.** Candidate policy axes (grant honouring, scope width, retention budgets, ttl at several values) measured offline on GateMem and LongMemEval: items denied at write, hidden at read, and the questions affected, with each axis marked flat or not.

Depends on: L2, L4, B6, RV1 (merged).

Acceptance: `make test`; `uv run python research/scripts/reproduce.py` on the four new MANIFEST rows (`make test-repro` restricted to them); each script's tests in `research/tests/`.

Out of scope: editing `docs/research/preregistration.md`; choosing the axes, the models, the ceilings or the audit's rule (the lead's); building C1 on LongMemEval, C6, C7 or the MERIT, MemoryAgentBench and tau2 harnesses (their costs are estimated from the design and marked so).
