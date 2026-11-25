# docs

The body of knowledge: how Engram is designed, why each choice was made, what is planned, what was read, and a dated record of every step. Back to the [root README](../README.md); the rules for working here are in [`AGENTS.md`](../AGENTS.md).

## Start here

| file | what it is |
|---|---|
| [`architecture.md`](architecture.md) | the design: layers, memory model, write and read paths, no-bypass, lifecycle, retention, model access, interfaces. A living document, updated by the PR that changes what it describes |
| [`roadmap.md`](roadmap.md) | phases, gates (A to D), the week plan, every task card in one table, the effort and compute budgets, the risks and the kill list |
| [`glossary.md`](glossary.md) | Engram's terms (scope, grant, provenance, governance tax, the invariants) and the words the papers use for them |
| [`dogfood.md`](dogfood.md) | the twin dogfood: each member runs a twin over their own Claude Code memory, and only counts leave the machine |

## Folders

| folder | what it holds |
|---|---|
| [`decisions/`](decisions/README.md) | the ADRs, `NNNN-<slug>.md`, 0001 to 0048 on 2026-11-25: every one is decided (ADR 0034's one-year expiry cap and first-write rule are accepted and not yet built), plus any an in-progress card proposes; the index gives each one's status |
| [`tasks/`](tasks/) | one file per task card (`<id>.md`: goal, files, dependencies, acceptance, status), and the plans that cut work into PRs: [`absorb-plan.md`](tasks/absorb-plan.md) (the thirty PRs of 2026-11-21), [`backlog.md`](tasks/backlog.md) (follow-ups by card), [`lead-decisions.md`](tasks/lead-decisions.md) (every decision put to the lead, with its answer), and the earlier plans (`step-0.md`, `gate-a-e0-e1-e2-plan.md`, `gate-b-plan.md`, `prereg-v1-plan.md`, `key-free-work-plan.md`) |
| [`research/`](research/) | the experiment design: [`preregistration.md`](research/preregistration.md) (question, conditions, benchmarks, models, statistics, H1 to H5, the proposed arms), [`positioning.md`](research/positioning.md) (the novelty claim against HEAMS and SAFE-Mem), [`prereg-v1-decisions.md`](research/prereg-v1-decisions.md), [`label-audit.md`](research/label-audit.md), [`baselines.md`](research/baselines.md), [`mpbench-request.md`](research/mpbench-request.md) (a draft, not sent), and [`absorb/`](research/absorb/README.md), the research behind the absorb plan |
| [`readings/`](readings/README.md) | the reading list by tier, and [`litreview/`](readings/litreview/README.md), one sourced note per paper (the source of truth for papers) and the frontier summary |
| [`conventions/`](conventions/) | [`documentation.md`](conventions/documentation.md) (the log and how it becomes the thesis), [`testing.md`](conventions/testing.md) (the test layers, fakes not mocks, the invariants), [`absorption.md`](conventions/absorption.md) (taking open-source code, data or ideas, ADR 0037) |
| [`compliance/`](compliance/README.md) | the claims crosswalk: each governance claim, the test that backs it, and the article of the EU AI Act or the GDPR it bears on (evidence, not compliance) |
| [`log/`](log/) | one typed, dated entry per step (decision, finding, failure, measurement, change, milestone), named `YYYY-MM-DD-<slug>.md`; `make thesis` consolidates it into `research/thesis/drafts/` |
| [`brand/`](brand/README.md) | the logo kit and the README banner |

## Registers

| file | what it lists |
|---|---|
| [`deps.md`](deps.md) | every dependency, with its exact version, reason and licence (AGENTS.md rule 11) |
| [`absorbed.md`](absorbed.md) | every piece of open-source code copied or ported in, with source, commit and licence (ADR 0037) |

## Checks on this folder

`make lint-docs` checks every log entry's frontmatter, that no prose holds an em dash, and that `CLAUDE.md` equals `AGENTS.md`. `scripts/test/tasks-and-decisions.test.ts` checks that every card in the roadmap has a file under `tasks/` and that every ADR in the index is decided, except those it names as the lead's to decide (ADR 0034 among them), so keep the index's table format as it is.
