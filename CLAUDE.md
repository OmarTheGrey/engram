# AGENTS.md

Operating manual for anyone, human or agent, working in this repository. CLAUDE.md is an exact copy of this file (symlinks are unreliable on Windows; `make lint-docs` fails if the two differ), and pi loads AGENTS.md as a context file. Read it in full before touching anything.

## What this is

Engram is a control plane above memory stores for agentic AI. Every memory write is checked against policy, every read is filtered by scope and grants, every decision is logged with a reason, and every recall can be explained. Three products sit on top: Govern (trusted organisational memory), Twin (a memory per person, split into person and role scopes), Distill (procedures mined from agent sessions, admitted after replay validation, retired on drift).

The plane is built on pi (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, and experimentally `@earendil-works/pi-durable`). Pi is the reference harness: its extension events are where the plane intercepts writes and reads, its session tree is the episodic record, and pi-ai is how any model is reached. Claude Code and Codex are supported harnesses through the MCP server and hooks, not the base. See `docs/decisions/0001-pi-as-base.md`.

This is a graduation project at Egypt University of Informatics with a thesis attached. Part I of the thesis depends on `packages/core`, `packages/adapters`, `packages/bench` and `research/`. Treat those as load-bearing: a regression there is a thesis problem, not a product bug.

## Where things live

```
AGENTS.md                 this file; CLAUDE.md is a checked copy; pi reads it as a context file
README.md                 what the project is and how to get in
Makefile                  every command the team and CI use; wraps pnpm and uv
pnpm-workspace.yaml       TypeScript workspace: everything that runs inside or beside pi
pyproject.toml            uv workspace: research only
packages/core/            the plane: schema, events, policy, lints, explain, distill. TypeScript. No store I/O, no model calls
packages/adapters/        one adapter per store: files, mem0, letta. Each implements the Adapter contract
packages/pi-extension/    the Engram pi extension: tools, tool_call and context handlers, commands, custom entries
packages/pi-package/      the distributable pi package (extension, skills, prompt templates)
packages/mcp/             MCP server exposing governed read, write, explain, simulate to Claude Code and Codex; the Claude Code hook
packages/cli/             `engram` command; calls core and adapters, holds no policy logic
packages/server/          HTTP API over core (route table, loopback only), the workspace opener; OpenAPI generated from it
packages/ui/              inspector; calls the generated client
packages/bench/           benchmark runners on the pi SDK, pinned in packages/bench/PINS.md; vendored upstream judges
packages/runner/          experiment runner: pi SDK sessions, seeded, cached; Pi Durable behind a flag
research/                 Python: configs/, scripts/, results/, analysis, stats, figures, thesis
sdk/                      generated: JSON Schema, sdk/openapi.json, the TypeScript client sdk/ts (@engram/sdk); do not edit by hand
docs/                     architecture, decisions, tasks, research, readings, deps, glossary
docs/architecture.md      the architecture: layers, memory model, write and read paths, interfaces (living document)
docs/roadmap.md           phases, gates, week plan and the task cards; cards are expanded into docs/tasks/
docs/conventions/         documentation.md (the log, thesis consolidation), testing.md (layers, fakes, fixtures)
docs/log/                 one typed, dated entry per step; consolidated into thesis drafts by `make thesis`
fixtures/                 sessions, stores, faults, cassettes; regenerated only by `make fixtures`
.pi/                      project extensions, skills and prompt templates for working in this repo
.claude/                  Claude Code settings, hooks, commands
.github/                  CI and the PR template
```

## Commands

```
pnpm install && uv sync        once, after clone
make test                      vitest (core, adapters, conformance on fakes, replay-from-events) and pytest (research)
                               core's Db tests also run on a throwaway embedded Postgres (no Docker); ENGRAM_PG_URL=<url> uses a server you name, ENGRAM_PG=skip skips them
make test-one T=<path>         one test file, with its seed printed
make test-invariants           the five invariants against the real Plane, with counterexample and seed; the fifth (retention budgets) since E2.4
make api                       regenerate sdk/schema (JSON Schema) and research/engram_types (Python) from the Zod schema, sdk/openapi.json from the server's route table, the TypeScript client in sdk/ts and packages/ui/src/api, and the provider key names doctor checks from pi-ai
make api-check                 make api, then fail if the generated files differ from what is committed
make bench BENCH=gatemem       run one benchmark on its fixture subset offline: scripted model, committed cassettes (a miss is an error, never recorded into them), output in .engram/bench/<name>; gatemem only so far
make bench BENCH=gatemem DRY=1 the live GateMem run counted on the full checkpoint set, no model called: its calls and prompt size (fetches the pinned data once into .engram/upstream); add MODEL=<provider/model-id> (and SEED=) to also list its cache keys for that model, never printed without it
make run CONFIG=<file>         replay a runner config: each (item, condition, store, seed) a pi SDK session, every model call from its cassettes, a miss an error; output in .engram/runs/<name>
make run CONFIG=<file> MODEL=<provider/model> LIVE=1   the same config on a named model, recording into new cassettes under .engram/runs/<name>-live (Gate B exception (c)); refused under ENGRAM_OFFLINE=1, only under .engram/ or outside the repo
make run CONFIG=<file> MODEL=<provider/model> REPLAY=1  replay that live run's cassettes; allowed offline, a miss an error
make run CONFIG=<file> COUNT=1 check the config's data against the pinned hashes (an experiment's GateMem data fetched at the pin when missing) and print the sessions it would run per condition, store and seed, into .engram/runs/<name>-count/count.json; no model called, no cassette read or written. An experiment config (research/configs/h1-*.json) runs only with MODEL= and LIVE=1 or REPLAY=1, or COUNT=1
make h1-table                  after H1's two live runs (make run CONFIG=research/configs/h1-gatemem.json, then h1-mem-inv.json, MODEL= and LIVE=1 or REPLAY=1): their rows as h1-sessions/2 (packages/runner/scripts/h1-sessions.ts) in .engram/runs/h1-sessions.jsonl, MEM-INV-Bench's UNREAD replies in .engram/runs/h1-unread.json for two readers, blind (opaque ids in an order the table config's seed shuffles; no condition, store, seed or item), the key from id to session beside it in .engram/runs/h1-unread-key.json (not for the readers), then research/scripts/h1_table.py into research/results/h1-table.json (the primary GateMem set, the secondary sets and the refusal-leak sensitivity table research/configs/h1-table.json names); the table also gives MGS per condition and MEM-INV-Bench's read_before_action; READINGS=<filled copy of the template> joins the readings back through that key, refusing a missing key or one that does not match the run, and writes no template; GATE_BY_ACTION=1 is the gate-by-action reading, which decides nothing (decides false), into its own .engram/runs/h1-sessions-gate-by-action.jsonl and research/results/h1-table-gate-by-action.json from research/configs/h1-table-gate-by-action.json, the main table's files, template and key untouched
make lint                      biome, tsc, ruff, mypy; CI runs the same
make lint-docs                 log entry frontmatter, em dashes in prose, CLAUDE.md equals AGENTS.md
make lint-docs PR=<dir>        the PR gate on a PR directory (body.md, files.txt); fixtures in fixtures/ci/
engram doctor                  log and its backend (never created by doctor), policy, store root, files and Mem0 adapters through the plane, the Letta adapter (git on the path, a write, read and delete in a temporary MemFS repository), provider keys by name only, benchmark pins and fixture hashes, the pi pin against docs/deps.md, Node 24 or later
engram read --root <dir> --owner <id>   a memory folder through the plane, adopted as its owner, every item explained; --store letta takes a Letta MemFS repository (or an empty folder it initialises) as --root, every write one git commit; the log is --db, else ENGRAM_DB_URL, else <home>/.engram/engram.db; engram --help lists the rest
engram write | read | promote | explain | retain | lint | simulate   each one call of the generated client: in process over the workspace its flags name, or to the server --server <url> (or ENGRAM_SERVER_URL) names
engram retain --scope <scope>  sweep one scope's retention as a user-sourced member: expired items retired, budgets enforced
engram lint --scope <scope>    the policy's enabled deterministic lints over one scope as a member; each finding one lint event with its reason; exit 1 on a finding
engram serve [--host 127.0.0.1] [--port 7313] [--as <id> --member <scope>]   the HTTP API on loopback only (no authentication yet), over the workspace flags; --as names the inspector's viewer
engram mcp --as <id> --member <scope>   the MCP server over stdio for Claude Code and Codex, every call as that actor with source model; --http <port> serves streamable HTTP on loopback
engram hook claude-code --root <dir>   a Claude Code PreToolUse hook: denies a Bash command naming a store and a file tool inside a store root, recording each block
make engram ARGS="<command> ..."   run the engram CLI from the repo (node packages/cli/src/main.ts)
make test-e2e                  layer 6: engram doctor, then a CLI smoke (write, read, explain) on a temp folder and on a Letta MemFS repository, on SQLite and on embedded Postgres; the MCP handshake from the Claude Code and Codex fixtures in fixtures/harness/ and the Claude Code hook; then make ui and the inspector in Chromium (playwright) on fixtures/workspaces/inspector; no Docker anywhere
make ui                        build the inspector (Vite and React) into packages/ui/dist, which engram serve serves at / beside /api/v1; Chromium for its e2e test: pnpm exec playwright install chromium
make test-repro                every row of research/results/MANIFEST.md rerun by its research/scripts/<name>.py from its config; fails on a sha256 that differs; ENGRAM_RESEARCH_WORKERS=<n> caps the worker processes of the H4 scripts (one per core otherwise; the bytes do not change)
                               a script needing pinned benchmark data fetches it (data, never a model) into .engram/upstream, so a fresh clone needs the network; CI does not run it
make fixtures                  regenerate golden files (the fault catalogue in fixtures/faults/ included) and record scripted cassettes afresh; refuses without a message; clones MEM-INV-Bench at its pin into .engram/upstream when missing (network) and runs its own scorer for the goldens
make fault-workspace FAULT=<name>   a SQLite log and policy file in .engram/faults/<name>/ from fixtures/faults/<name>.json, and the engram lint command that lints it
make thesis                    consolidate docs/log into research/thesis/drafts/ (ROOT=, OUT= to run on fixtures/log/repo)
pi                             work in this repo with the project extension loaded
```

If a command you need is not here, add it to the Makefile and to this list in the same PR.

## Rules

1. Logic lives in `packages/core` and `packages/adapters`. Everything else (pi-extension, mcp, cli, server, ui) calls them. If you are writing an `if` about policy outside core, stop.
2. Reads and writes to any store go through `Plane.read` and `Plane.write`. Never call an adapter directly outside its own tests. Inside pi, the only path to a store is the Engram tools, and the `tool_call` handler is where the gate runs.
3. Every policy decision emits a MemoryEvent with `reason` and `policy_id` to the Engram log, and a `custom` entry (`customType: "engram.event"`) to the pi session. A decision without both is a bug.
4. The plane never calls a model. Model-based lints and the distiller receive a `ModelCall` function injected at the boundary; inside pi it is built on pi-ai through the session's model runtime. `packages/core` has no import from pi-ai.
5. Schema changes are one PR: edit `packages/core/src/schema.ts`, bump `schema_version`, add a migration, run `make api`, update fixtures. Nothing else goes in that PR.
6. Every sampled model call takes a seed from the experiment config. No unseeded randomness anywhere under `packages/bench`, `packages/runner` or `research/`.
7. Every model call in a run is cached, keyed on (benchmark item, condition, preset, store, model, seed, prompt hash). A re-run with the same config makes zero new calls.
8. Benchmarks are pinned in `packages/bench/PINS.md`. Never update a pin mid-experiment. Updating a pin is its own PR with the diff in results explained.
9. No result is real unless `research/scripts/<name>.py` regenerates it from `research/configs/` into `research/results/`. Numbers typed by hand into a document do not exist.
10. One task card per PR. Title is the card id and its goal.
11. A new dependency is one line in `docs/deps.md` with the reason and the license, in the same PR that adds it. Pi packages are pinned to exact versions.
12. Dogfood content (the team's own sessions and memories) never leaves the member's machine. Only aggregate counts are committed.
13. Written content in this repository uses no em dashes. Commas, periods, or a restructured sentence.
14. Every PR adds a log entry under `docs/log/` in the format of `docs/conventions/documentation.md`. CI rejects a PR without one. Failures are logged like successes.
15. Tests follow `docs/conventions/testing.md`: fakes not mocks, scripted or cassette models, injected clock and seeds, acceptance test before implementation, invariants file always on. A card without the tests that convention requires is not done.

## How to work a task card

Cards live in `docs/tasks/<id>.md`. Each has a goal, the files you may touch, what it depends on, an acceptance command, and what is out of scope.

1. Read the card and AGENTS.md. Read `docs/architecture.md` if the card touches `packages/core`, `packages/adapters` or `packages/pi-extension`. `docs/roadmap.md` places the card in its phase and gate.
2. Check that every card in `depends on` is merged. If not, stop and say so.
3. Propose a plan in the PR description before writing code. Keep it to the files the card names.
4. Write the test or fixture that the acceptance command runs first, if the card does not already ship it.
5. Implement. Do not modify the acceptance test. Do not touch another package. Add the tests `docs/conventions/testing.md` requires for what you added.
6. Run `make test` and the acceptance command. Both must pass locally.
7. Write the log entry under `docs/log/` (`docs/conventions/documentation.md`): what, why, result with evidence paths, consequence. Log what failed on the way as separate `failure` entries.
8. Open the PR with the template filled in. The acceptance command goes in the acceptance field; CI fails a PR without one or without a log entry.

## Definition of done for a card

- The acceptance command passes locally and in CI.
- `make test` passes, with the tests the testing convention requires for the change.
- A log entry exists for the card, and one per failure met on the way.
- An event log excerpt or a pi session fixture demonstrating the change is in the PR description.
- `docs/deps.md` updated if a dependency was added.
- AGENTS.md updated if a rule or a command changed.
- `docs/decisions/` has a new ADR if the card made a choice that another card could have made differently.

## What not to do

- Do not add a store-specific branch to `packages/core`. If a store needs special handling, it goes in its adapter behind the contract.
- Do not import pi-ai, pi-coding-agent or pi-durable in `packages/core` or `packages/adapters`. They are reached only from `packages/pi-extension`, `packages/runner` and `packages/bench`.
- Do not bypass the Engram tools from inside a pi session. A direct `bash` call to a store's CLI is a write the gate never saw; the extension blocks known store commands in `user_bash` and `tool_call`.
- Do not add a benchmark, an induction method, or a statistical test that is not in `docs/research/preregistration.md`. Propose it there first; the change is reviewed before any run.
- Do not write retrieval ranking that cannot be explained. Every returned item carries the components of its score and the policy decision that admitted it.
- Do not edit `sdk/` or `packages/ui/src/api/`. They are generated by `make api`.
- Do not silence a failing conformance test by marking it as adapter-specific. The contract is the same for every store.
- Do not depend on Pi Durable outside `packages/runner`, and only behind the `ENGRAM_RUNNER=durable` flag. It is experimental upstream.

## Cadence

Monday: cards assigned, dependencies checked. Wednesday: thirty-minute unblock. Friday: demo from a recorded pi session or a results table; nothing merges without one. Gates: A at week 2, B at week 6, C at week 10 (go or pivot), D at week 16.

## Disclosure

The thesis methods chapter states that implementation used coding agents under these conventions, that experiment code and analysis were hand-reviewed, and that every generated component carries tests. Keep that true.
