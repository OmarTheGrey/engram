# Limitations

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

## Failures

- **2026-10-17, S0.1, failure.** Running `biome migrate --write` on Biome 2.5.15 to replace the deprecated `rules.recommended: true` produced `rules.preset: "none"`, which turns every lint rule off. Consequence: Any future Biome migration is followed by reading `biome.json` back and running a probe before merging.
- **2026-10-17, S0.1, failure.** The first CI run of S0.1 failed before any step ran because `astral-sh/setup-uv@v10` does not resolve. Consequence: Before adding an action, check that the tag exists (`gh api repos/<owner>/<repo>/git/matching-refs/tags/v`).
- **2026-10-17, S0.3, failure.** On Windows, the check scripts crashed with a libuv assertion (`!(handle->flags & UV_HANDLE_CLOSING)`, `src\win\async.c`) when they called `process.exit(1)` straight after writing problems to stderr. Consequence: Scripts in this repository set `process.exitCode` and never call `process.exit` after writing output.

No entries yet.
