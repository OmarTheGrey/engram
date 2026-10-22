# Evaluation

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

## Plane

**2026-10-22, S0.13, milestone.** Step 0 finished: S0.13 decided ADRs 0002 to 0023 except 0020, gave every roadmap card a file under `docs/tasks/` (61 from the roadmap, four rewritten for ADR 0001, five added: PX1 to PX3, RN1, RN2), and the outcome table in `docs/tasks/step-0.md` records every task. The exit criterion of step 0 is that every convention runs in CI and every proposed decision is made before E0.2. 94 checks pass in `scripts/test/tasks-and-decisions.test.ts`. Two items remain with the lead: the MPBench contact date and ADR 0020 (the roadmap says MIT, the ADR recommends Apache-2.0). Work continues at E0.2's successors on the critical path: E0.3, E1.2, A1.[^1][^2][^3]

## Research

**2026-10-22, S0.12, milestone.** Step-0 task S0.12 wrote pre-registration v0: the question, seven conditions, the six pinned benchmarks, three model slots, three seeds, the statistics, and for each of H1 to H5 its conditions, benchmarks, metric, test, stopping rule, analysis and results files. It is tagged `prereg-v0`. Gate A requires a dated pre-registration before any run (ADR 0023). `research/tests/test_prereg.py` passes 9 checks, including that every manifest result maps to exactly one hypothesis; removing one field makes it fail. The hypothesis wording is reconstructed from the roadmap, ADRs and literature review because the proposal was not available; thresholds are marked proposed and models are placeholders. The lead confirms or amends v0 before `prereg-v1`, which is the version deposited externally.[^4][^5][^6][^7]

**2026-10-22, S0.6, finding, H1.** GateMem (arXiv 2606.18829) has code and data: rzhub/GateMem at a983828 (MIT) and Hugging Face Ray368/GateMem (CC-BY-4.0), 91 episodes and 2,218 checkpoints. The governance arm of ADR 0015 needs a released benchmark, and the literature-review note recorded no code found. Judge is GPT-4o; plug-in is a `BaseMemoryAgent` subclass or a predictions file. The hidden scoring fields (`expected_action`, `leak_targets`) ship in the files the agent reads. The bench adapter strips the hidden fields before the plane sees a checkpoint. The review note is superseded by PINS.md, not edited.[^8][^9]

**2026-10-22, S0.6, finding, H2.** LongMemEval (arXiv 2410.10813, ICLR 2025) is released: xiaowu0162/LongMemEval at 9e0b455 (MIT) with the cleaned data on Hugging Face at revision 98d7416. The recall and knowledge-update arm of ADR 0015 needs a pinned revision. Judge is `gpt-4o-2024-08-06` at temperature 0; plug-in is a predictions file. Results on the 2025 cleaned files are not comparable with the 2024 originals. The cleaned revision is pinned; the 2.7 GB M split is out of the fixture subset.[^10][^11]

**2026-10-22, S0.6, finding, H4.** MemoryAgentBench (arXiv 2507.05257, ICLR 2026) is released: HUST-AI-HYZ/MemoryAgentBench at 5380260 (MIT) with Parquet data on Hugging Face at revision 7ea0669. The competencies arm of ADR 0015 needs a pinned revision. Scoring is mostly exact match; two subsets use GPT-4o. The fourth competency is called selective forgetting in the paper and Conflict Resolution in the code and data. Plug-in is a branch in `agent.py` plus a method module; source datasets keep their own licences, which the label audit must check.[^12][^13]

**2026-10-22, S0.6, finding, H2.** MERIT (arXiv 2609.05441) is released: smshweta/merit-bench at 293933d (MIT), with seeded, procedurally generated worlds instead of a static dataset. MERIT's cost accounting is the model for the governance tax (H2). Scoring is deterministic (programmatic checkers, scripted user), so it runs without a judge model. The repository is new and unreviewed, and its `HYPOTHESES.md` cites a `prereg-v1` tag that does not exist. Plug-in is a `MemoryBase` subclass; Engram sits behind it as one condition.[^14][^15]

**2026-10-22, S0.6, finding, H4.** tau2-bench (arXiv 2506.07982) is released, but the repository has moved to tau3-bench; it is pinned to tag v1.0.1 (fc0055d) rather than the moving head. The tool-use arm of ADR 0015 needs results that stay comparable. Scoring is mostly deterministic; retail NL assertions and the user simulator use `gpt-4.1-2025-04-14`. It does not test memory. It serves as the harness a memory layer is inserted into; numbers are not compared with the 2025 paper.[^16][^17]

[^1]: `docs/tasks/step-0.md`
[^2]: `docs/decisions/README.md`
[^3]: `scripts/test/tasks-and-decisions.test.ts`
[^4]: `docs/research/preregistration.md`
[^5]: `research/tests/test_prereg.py`
[^6]: `uv run pytest research/tests/test_prereg.py`
[^7]: `git show prereg-v0`
[^8]: `packages/bench/PINS.md`
[^9]: <https://github.com/rzhub/GateMem>
[^10]: `packages/bench/PINS.md`
[^11]: <https://github.com/xiaowu0162/LongMemEval>
[^12]: `packages/bench/PINS.md`
[^13]: <https://github.com/HUST-AI-HYZ/MemoryAgentBench>
[^14]: `packages/bench/PINS.md`
[^15]: <https://github.com/smshweta/merit-bench>
[^16]: `packages/bench/PINS.md`
[^17]: <https://github.com/sierra-research/tau2-bench>
