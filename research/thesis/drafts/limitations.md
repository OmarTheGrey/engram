# Limitations

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

## Failures

- **2026-10-17, S0.1, failure.** Running `biome migrate --write` on Biome 2.5.15 to replace the deprecated `rules.recommended: true` produced `rules.preset: "none"`, which turns every lint rule off. Consequence: Any future Biome migration is followed by reading `biome.json` back and running a probe before merging.
- **2026-10-17, S0.1, failure.** The first CI run of S0.1 failed before any step ran because `astral-sh/setup-uv@v10` does not resolve. Consequence: Before adding an action, check that the tag exists (`gh api repos/<owner>/<repo>/git/matching-refs/tags/v`).
- **2026-10-17, S0.3, failure.** On Windows, the check scripts crashed with a libuv assertion (`!(handle->flags & UV_HANDLE_CLOSING)`, `src\win\async.c`) when they called `process.exit(1)` straight after writing problems to stderr. Consequence: Scripts in this repository set `process.exitCode` and never call `process.exit` after writing output.
- **2026-10-17, S0.5, failure.** The S0.5 session fixture recorded on Windows failed on Linux CI. Consequence: Session fixtures are accepted only after a green run on both Windows and Linux.
- **2026-10-22, S0.10, failure.** The test proving the pi-import lint rule timed out in the full suite although it passed alone. Consequence: Tests that spawn tools set an explicit timeout.
- **2026-10-22, S0.11, failure.** The S0.11 commit was made and pushed while `make lint` failed on a TypeScript error in the conformance suite. Consequence: Commits are chained on `make lint && make test`, so a failing gate stops the commit; CI would also have caught it.
- **2026-10-22, S0.12, failure.** The tag `prereg-v0` was first created and pushed on commit 7515b0d, the S0.11 typing fix, instead of the pre-registration commit. Consequence: A tag is created only in the same chain as the commit it marks, after the commit succeeds.

## Plane

**2026-10-22, S0.10, finding.** pi-ai 1.3.0's request options (`StreamOptions`, `SimpleStreamOptions`) carry temperature and maxTokens but no sampling seed. ADR 0016 and AGENTS.md rule 6 assume every sampled call takes a seed from the experiment config. The seed cannot be passed to providers through pi-ai. It is part of the cache key instead, so each seed is one recorded sample and reruns replay it exactly. Seeds give reproducible replays and independent replicates, not reproducible fresh samples; the methods chapter says so, and the optional seeded open-weights arm (roadmap X8) is the only bit-exact path.[^1][^2]

## Research

**2026-10-22, S0.6, finding, H1.** MPBench (arXiv 2606.04329) has no code or data release; it is an AIWILD workshop paper at ICML 2026, not a main-conference paper. The poisoning arm of ADR 0015 depends on it. Searched the abstract, PDF links, ICML page, GitHub and Hugging Face; found only two empty dataset repositories under accounts named after two authors. The judge model is not named in the paper. A request to the corresponding author is drafted, not sent. Card BF1 reconstructs the probe format; MEM-INV-Bench is the alternative.[^3][^4][^5]

[^1]: `packages/runner/src/model/pi.ts`
[^2]: `fixtures/cassettes/README.md`
[^3]: `packages/bench/PINS.md`
[^4]: `docs/research/mpbench-request.md`
[^5]: `docs/tasks/BF1-mpbench-fallback.md`
