# RV2 Experiment-pipeline review: H1's decision bound test, the readings kit, the MANIFEST commit cells

Status: done on branch `rv2`, awaiting review. RV-EXP-6: `research/tests/test_analysis.py` (p = 0.011 undecided; `adjusted` equals 5p). RV-EXP-7: `packages/runner/src/research/h1-sessions.ts`, `packages/runner/scripts/h1-sessions.ts`, their tests (`packages/runner/test/research/h1-sessions.test.ts`, `research/tests/test_h1_pipeline.py`), the Makefile's `h1-table` help, AGENTS.md and CLAUDE.md, `research/configs/h1-table.json` and `h1-table-gate-by-action.json` (`how_to`), section 7 of `docs/tasks/prereg-v1-plan.md`. RV-EXP-9: `research/results/MANIFEST.md`'s four commit cells. Log: `docs/log/2026-11-19-rv2-*.md`.

Added by the repository review of 2026-11-19 (the experiment-pipeline review, findings RV-EXP-6, RV-EXP-7 and RV-EXP-9). Card RV1 takes the runner's live-run findings (RV-EXP-1 to RV-EXP-5 and RV-EXP-10) in parallel; RV-EXP-8 is for the lead and a later card.

Goal: H1's Gate C decision bound has a test that fails when the bound's factor is wrong; the UNREAD readings kit keeps the two readers independent (one file per reader, joined by the tool) and refuses a dropped reply; every MANIFEST row names the squash commit on main that holds its code.

Files: `research/tests/test_analysis.py`; `packages/runner/src/research/h1-sessions.ts`, `packages/runner/scripts/h1-sessions.ts`, `packages/runner/test/research/h1-sessions.test.ts`, `research/tests/test_h1_pipeline.py`; `Makefile` (the `h1-table` help), AGENTS.md and CLAUDE.md (the `make h1-table` line), `research/configs/h1-table.json` and `research/configs/h1-table-gate-by-action.json` (`how_to` only), `docs/tasks/prereg-v1-plan.md` (section 7, the reading step); `research/results/MANIFEST.md` (commit cells only, no sha256).

Depends on: none (main at `07828fc`).

Acceptance: `uv run pytest research/tests/test_analysis.py research/tests/test_h1_pipeline.py && pnpm exec vitest run packages/runner/test/research/h1-sessions.test.ts`, with the bound's 4p mutant failing `test_analysis.py`; every MANIFEST commit cell an ancestor of main (`git merge-base --is-ancestor <commit> main`).

Out of scope: the runner's live-run findings (card RV1: `packages/runner/src/*-probe.ts`, `conditions.ts`, `run.ts`, the judge); the pre-registration's text and the decision sheet, which are the lead's (their wording of the reading step is proposed in a finding); any sha256 in the MANIFEST.
