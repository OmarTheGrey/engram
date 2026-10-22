# Implementation

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

## Plane

**2026-10-17, milestone.** The body of knowledge for the repository was written before any code: operating manual, ADR 0001 (pi as base), documentation and testing conventions, proposed ADRs 0002 to 0023, the step-0 task list, the readings list and the glossary. So the first card is worked under the conventions rather than before them, and so the thesis can be assembled from the log instead of from memory. Files listed under evidence. No measurements yet. Step 0 starts at S0.1. ADRs 0002 to 0023 are decided in S0.13.[^1][^2][^3][^4]

**2026-10-17, decision.** The lead removed the PR size limit: AGENTS.md rule 10 no longer caps a PR at 400 changed lines or asks for a card to be split first, and the card prompt pattern no longer says "Keep the diff under 400 lines". The limit was forcing cards such as S0.3 (518 changed lines, mostly tests) to be split into halves that are not useful on their own. Rule 10 now reads "One task card per PR. Title is the card id and its goal." The same sentence is gone from `docs/tasks/step-0.md` and `.pi/APPEND_SYSTEM.md`. One card per PR still holds; reviewers judge size case by case.[^5][^6][^7]

**2026-10-17, S0.1, failure.** Running `biome migrate --write` on Biome 2.5.15 to replace the deprecated `rules.recommended: true` produced `rules.preset: "none"`, which turns every lint rule off. The deprecation notice asked for the migration; the result was only caught because the config was read back after migrating. With `preset: "none"`, `make lint` passed while enforcing nothing. After setting `preset: "recommended"`, a probe file with `any`, `==`, an inner `var` and an unused variable produced four diagnostics (`noExplicitAny`, `noDoubleEquals`, `noInnerDeclarations`, `noUnusedVariables`). Any future Biome migration is followed by reading `biome.json` back and running a probe before merging.[^8][^9]

**2026-10-17, S0.1, change.** Step-0 task S0.1 bootstrapped the monorepo: pnpm workspace with nine package stubs (core, adapters, pi-extension, runner, bench, mcp, cli, server, ui), a uv workspace with `research` as its member, Biome, TypeScript, Vitest, fast-check, ruff, mypy, pytest, Hypothesis, a Makefile and a GitHub Actions workflow running `make lint` and `make test`. Every later card runs its acceptance command through the Makefile, so the commands must exist before the first real card. Before: `make test` failed with `Command "vitest" not found`. After: `make test` passes on an empty suite (Vitest with `passWithNoTests`, pytest exit code 5 accepted) and `make lint` passes. TypeScript is 7.0.2, not the 5.x in ADR 0019, on the lead's instruction; ADR 0019 is amended. Unimplemented targets exit 2 naming their card. Windows members need GNU make (`winget install ezwinports.make`).[^10][^11][^12][^13]

**2026-10-17, S0.1, failure.** The first CI run of S0.1 failed before any step ran because `astral-sh/setup-uv@v10` does not resolve. The workflow used floating major tags for every action. `actions/checkout`, `actions/setup-node` and `pnpm/action-setup` publish them; `astral-sh/setup-uv` stopped at `v7`, and its current release is only tagged `v10.3.0`. Run 39048041089 failed in "Set up job" with "unable to find version `v10`". The workflow now pins `astral-sh/setup-uv@v10.3.0`. Before adding an action, check that the tag exists (`gh api repos/<owner>/<repo>/git/matching-refs/tags/v`).[^14][^15]

**2026-10-17, S0.2, milestone.** Step-0 task S0.2 completed the body of knowledge and the harness setup: `make lint-docs` (em dashes in prose, CLAUDE.md equals AGENTS.md, log entry field set), a log template at `docs/log/_template.md`, the card prompt pattern and session rules in `.pi/APPEND_SYSTEM.md`, and `.claude/` settings and commands mirroring the three pi prompts. CLAUDE.md was described as a symlink, which is unreliable on Windows, so it is now a copy that CI compares byte for byte. pi 1.3.0 in RPC mode (`get_commands`, run with `-a`) lists `adr`, `card` and `log-entry` as project prompts; its resource loader finds one context file, AGENTS.md, so the copy is not loaded twice. `make lint-docs` passes, and fails on a seeded em dash, a drifted CLAUDE.md and an entry missing fields. S0.3 hardens the log validator and adds the PR checks.[^16][^17][^18][^19][^20]

**2026-10-17, S0.3, change.** Step-0 task S0.3 added the convention gates: `check-pr.ts` (the PR body has an `Acceptance:` line with a real command, and the diff adds a valid docs/log entry), a full log validator (field set, enums, real dates, H1 to H5, evidence paths exist, supersedes points at an entry, body sections in order, at most 150 words), fixture PRs under `fixtures/ci/`, and `conventions.yml` running the gate on every pull request. AGENTS.md rule 14 and the documentation convention say CI rejects a PR without a log entry or an acceptance command. `make lint-docs PR=fixtures/ci/pr-no-log` fails with "PR diff must add or change an entry under docs/log/"; `PR=fixtures/ci/pr-valid` passes; both are asserted in `scripts/test/fixtures-ci.test.ts`. All seven existing entries pass. Edits to existing entries are not yet detected; immutability is enforced in review only.[^21][^22][^23][^24][^25][^26]

**2026-10-17, S0.3, failure.** On Windows, the check scripts crashed with a libuv assertion (`!(handle->flags & UV_HANDLE_CLOSING)`, `src\win\async.c`) when they called `process.exit(1)` straight after writing problems to stderr. `process.exit` tears the process down while the stderr pipe write is still pending; the scripts ran under make, whose stderr is a pipe. The gate still failed, but with exit code 127 and a crash message instead of exit code 1. Setting `process.exitCode` and returning lets the write finish; the same run now exits 1 with only the problem line. Scripts in this repository set `process.exitCode` and never call `process.exit` after writing output.[^27][^28]

**2026-10-17, S0.5, failure.** The S0.5 session fixture recorded on Windows failed on Linux CI. Three values were not stable: the faux provider's default API id embeds a timestamp and a random suffix; the system prompt carries the temporary working directory with forward slashes; and the faux provider estimates token usage from prompt length, which depends on that path. The first two were caught locally across repeated runs; usage was caught by CI, where input token counts differed by seven per call. The scripted model now takes a fixed API id, and the normalizer replaces both path spellings and the usage object. Session fixtures are accepted only after a green run on both Windows and Linux.[^29][^30]

**2026-10-17, S0.5, finding.** Step-0 task S0.5 pinned pi 1.3.0 and proved the interception points in a pi SDK session with a scripted model: tool_call blocks an org-scoped memory_write, context tags memory, every decision is an `engram.event` custom entry, and store commands are blocked in user_bash and in the model's bash tool. ADR 0001 rests on these events behaving as documented. tool_call, context and appendEntry behaved as documented; 15 tests pass. Three differences: `createAgentSession` has no `extensionFactories` option (it moved to `DefaultResourceLoader`); `session.executeBash` never emits user_bash, only the interactive and RPC hosts do; user_bash has no block result, so blocking returns a replacement result. The runner must emit user_bash itself. The context tag is request-local; the session keeps untagged results.[^31][^32][^33][^34]

## Research

**2026-10-17, S0.4, change.** Step-0 task S0.4 added `research/scripts/consolidate_log.py`: it validates every docs/log entry (the same rules as `scripts/check-log.ts`, plus measurement hashes against `research/results/MANIFEST.md`) and writes the seven chapter drafts, `timeline.md`, `results-index.md` and `decisions.md`. The thesis is assembled from the log, so consolidation must be deterministic and refuse invalid entries. On the ten-entry fixture under `fixtures/log/repo`, `make thesis` output is byte-identical to `fixtures/log/expected`; 9 pytest cases pass, including a tampered results hash and a measurement without a config. `limitations.md` holds both the failure list and the limitations chapter, because the convention names that file twice. Superseded entries are left out of all drafts. `make fixtures MSG=...` regenerates the goldens.[^35][^36][^37][^38]

[^1]: `AGENTS.md`
[^2]: `docs/decisions/0001-pi-as-base.md`
[^3]: `docs/conventions/documentation.md`
[^4]: `docs/conventions/testing.md`
[^5]: `AGENTS.md`
[^6]: `docs/tasks/step-0.md`
[^7]: `.pi/APPEND_SYSTEM.md`
[^8]: `biome.json`
[^9]: `pnpm exec biome migrate --write`
[^10]: `Makefile`
[^11]: `.github/workflows/ci.yml`
[^12]: `make test`
[^13]: `make lint`
[^14]: `.github/workflows/ci.yml`
[^15]: `gh run view 39048041089 --log-failed`
[^16]: `make lint-docs`
[^17]: `scripts/check-prose.ts`
[^18]: `scripts/check-log.ts`
[^19]: `.pi/APPEND_SYSTEM.md`
[^20]: `.claude/commands/card.md`
[^21]: `.github/workflows/conventions.yml`
[^22]: `scripts/check-pr.ts`
[^23]: `scripts/check-log.ts`
[^24]: `scripts/test/check-log.test.ts`
[^25]: `fixtures/ci/pr-valid/files.txt`
[^26]: `make lint-docs PR=fixtures/ci/pr-no-log`
[^27]: `scripts/check-pr.ts`
[^28]: `make lint-docs PR=fixtures/ci/pr-no-log`
[^29]: `packages/pi-extension/test/harness.ts`
[^30]: `pnpm --filter pi-extension test`
[^31]: `fixtures/sessions/s0-interception.jsonl`
[^32]: `fixtures/sessions/s0-interception.expected.json`
[^33]: `packages/pi-extension/test/interception.test.ts`
[^34]: `pnpm --filter pi-extension test`
[^35]: `research/scripts/consolidate_log.py`
[^36]: `research/tests/test_consolidate.py`
[^37]: `fixtures/log/expected/limitations.md`
[^38]: `make thesis ROOT=fixtures/log/repo OUT=<tmp>`
