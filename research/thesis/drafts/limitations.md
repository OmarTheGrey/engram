# Limitations

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

## Failures

- **2026-10-17, S0.1, failure.** Running `biome migrate --write` on Biome 2.5.15 to replace the deprecated `rules.recommended: true` produced `rules.preset: "none"`, which turns every lint rule off. Consequence: Any future Biome migration is followed by reading `biome.json` back and running a probe before merging.
- **2026-10-17, S0.1, failure.** The first CI run of S0.1 failed before any step ran because `astral-sh/setup-uv@v10` does not resolve. Consequence: Before adding an action, check that the tag exists (`gh api repos/<owner>/<repo>/git/matching-refs/tags/v`).
- **2026-10-17, S0.3, failure.** On Windows, the check scripts crashed with a libuv assertion (`!(handle->flags & UV_HANDLE_CLOSING)`, `src\win\async.c`) when they called `process.exit(1)` straight after writing problems to stderr. Consequence: Scripts in this repository set `process.exitCode` and never call `process.exit` after writing output.
- **2026-10-17, S0.5, failure.** The S0.5 session fixture recorded on Windows failed on Linux CI. Consequence: Session fixtures are accepted only after a green run on both Windows and Linux.

## Research

**2026-10-22, S0.6, finding, H1.** MPBench (arXiv 2606.04329) has no code or data release; it is an AIWILD workshop paper at ICML 2026, not a main-conference paper. The poisoning arm of ADR 0015 depends on it. Searched the abstract, PDF links, ICML page, GitHub and Hugging Face; found only two empty dataset repositories under accounts named after two authors. The judge model is not named in the paper. A request to the corresponding author is drafted, not sent. Card BF1 reconstructs the probe format; MEM-INV-Bench is the alternative.[^1][^2][^3]

[^1]: `packages/bench/PINS.md`
[^2]: `docs/research/mpbench-request.md`
[^3]: `docs/tasks/BF1-mpbench-fallback.md`
