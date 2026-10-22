# Evaluation

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

## Research

**2026-10-22, S0.6, finding, H1.** GateMem (arXiv 2606.18829) has code and data: rzhub/GateMem at a983828 (MIT) and Hugging Face Ray368/GateMem (CC-BY-4.0), 91 episodes and 2,218 checkpoints. The governance arm of ADR 0015 needs a released benchmark, and the literature-review note recorded no code found. Judge is GPT-4o; plug-in is a `BaseMemoryAgent` subclass or a predictions file. The hidden scoring fields (`expected_action`, `leak_targets`) ship in the files the agent reads. The bench adapter strips the hidden fields before the plane sees a checkpoint. The review note is superseded by PINS.md, not edited.[^1][^2]

**2026-10-22, S0.6, finding, H2.** LongMemEval (arXiv 2410.10813, ICLR 2025) is released: xiaowu0162/LongMemEval at 9e0b455 (MIT) with the cleaned data on Hugging Face at revision 98d7416. The recall and knowledge-update arm of ADR 0015 needs a pinned revision. Judge is `gpt-4o-2024-08-06` at temperature 0; plug-in is a predictions file. Results on the 2025 cleaned files are not comparable with the 2024 originals. The cleaned revision is pinned; the 2.7 GB M split is out of the fixture subset.[^3][^4]

**2026-10-22, S0.6, finding, H4.** MemoryAgentBench (arXiv 2507.05257, ICLR 2026) is released: HUST-AI-HYZ/MemoryAgentBench at 5380260 (MIT) with Parquet data on Hugging Face at revision 7ea0669. The competencies arm of ADR 0015 needs a pinned revision. Scoring is mostly exact match; two subsets use GPT-4o. The fourth competency is called selective forgetting in the paper and Conflict Resolution in the code and data. Plug-in is a branch in `agent.py` plus a method module; source datasets keep their own licences, which the label audit must check.[^5][^6]

**2026-10-22, S0.6, finding, H2.** MERIT (arXiv 2609.05441) is released: smshweta/merit-bench at 293933d (MIT), with seeded, procedurally generated worlds instead of a static dataset. MERIT's cost accounting is the model for the governance tax (H2). Scoring is deterministic (programmatic checkers, scripted user), so it runs without a judge model. The repository is new and unreviewed, and its `HYPOTHESES.md` cites a `prereg-v1` tag that does not exist. Plug-in is a `MemoryBase` subclass; Engram sits behind it as one condition.[^7][^8]

**2026-10-22, S0.6, finding, H4.** tau2-bench (arXiv 2506.07982) is released, but the repository has moved to tau3-bench; it is pinned to tag v1.0.1 (fc0055d) rather than the moving head. The tool-use arm of ADR 0015 needs results that stay comparable. Scoring is mostly deterministic; retail NL assertions and the user simulator use `gpt-4.1-2025-04-14`. It does not test memory. It serves as the harness a memory layer is inserted into; numbers are not compared with the 2025 paper.[^9][^10]

[^1]: `packages/bench/PINS.md`
[^2]: <https://github.com/rzhub/GateMem>
[^3]: `packages/bench/PINS.md`
[^4]: <https://github.com/xiaowu0162/LongMemEval>
[^5]: `packages/bench/PINS.md`
[^6]: <https://github.com/HUST-AI-HYZ/MemoryAgentBench>
[^7]: `packages/bench/PINS.md`
[^8]: <https://github.com/smshweta/merit-bench>
[^9]: `packages/bench/PINS.md`
[^10]: <https://github.com/sierra-research/tau2-bench>
