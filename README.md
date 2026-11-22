<p align="center"><img src="docs/brand/engram-banner.svg" alt="Engram, a control plane for agent memory" width="100%"></p>

# Engram

Engram is a control plane for the long-term memory of AI agents. It sits between an agent and the store that holds its memory (a folder of Markdown files such as Claude Code's memory, an in-process Mem0, or a Letta MemFS repository, which is git-backed Markdown) and decides every write and every read by a typed policy: who may write what into which scope, who may read it back, how long it stays valid, and where it came from. Every decision is appended to an event log with its reason and the rule that made it, and every item a read returns can be explained. The store's own code is not changed: it keeps the bytes, and the plane keeps the metadata (scope, provenance, validity, grants, status). The plane never calls a model.

Engram is a graduation project at Egypt University of Informatics with a thesis attached, and it carries an experiment programme whose design is pre-registered (v0 tagged, v1 tagged before the first run): what does enforcing memory governance at the boundary cost, compared with asking the model to behave?

## Contents

- [What Engram is](#what-engram-is)
- [Why it exists](#why-it-exists)
- [How it fits together](#how-it-fits-together)
- [Status, 2026-11-21](#status-2026-11-21)
- [Quick start](#quick-start)
- [Common commands](#common-commands)
- [The research programme](#the-research-programme)
- [Repository map](#repository-map)
- [Contributing](#contributing)
- [What is next](#what-is-next)
- [Licence and attribution](#licence-and-attribution)
- [Links](#links)

## What Engram is

Agents now keep memory across sessions: facts about a user, decisions of a team, procedures that worked. Most memory stores take whatever the agent writes and return whatever matches a query. Engram puts a gate in front of the store.

**The plane.** Five mechanisms, all in [`packages/core`](packages/core/README.md):

| mechanism | what it does |
|---|---|
| write gate | `Plane.write` checks the writer's membership of the target scope, the item's class, its source (user, document, tool, model, import, compaction, external) and its confidence against the policy before the store is touched. When the policy turns them on (they are off by default and in every registered preset), content guards also screen the content for secrets, personal data and instructions injected for the agent. A denied write never reaches the store. |
| read filter | `Plane.read` admits only items in scopes the reader may read, or reached through a grant that names it, and only inside their validity window and time to live. Filtering comes before ranking, so hidden items never take a place in the results. |
| event log | Every decision appends one `MemoryEvent` with the actor, the scopes, the decision (allow, deny or ask), a `reason` and a `policy_id`. The log is the source of truth: the item set is a projection of it. SQLite by default, Postgres as an option. |
| explain | Every item a read returns carries its score components (relevance, confidence, recency), its rank, the rule that admitted it, the grants it used and its validity window. `Plane.explain` returns them to the reader who made the read, and to no one else. |
| replay | The item set as it stood after any event can be rebuilt from the log alone (`itemsAt`), and a recorded workload can be replayed under another policy to see what would change (`Plane.simulate`, `engram simulate`). |

Terms such as *scope*, *grant*, *provenance*, *preset*, *cassette*, *task card*, *card id*, *gate*, *MemFS*, *absorb plan* and *governance tax* are defined in the [glossary](docs/glossary.md). A *preset* is one of three bundled policies, strict, medium and permissive; a *task card* is one unit of work under `docs/tasks/`, named by an id such as E2.9 (its epic and number).

**Three products** sit on the one plane, each a policy profile plus a few screens:

- **Govern.** Trusted organisational memory: provenance on every item, validity windows, lints that flag stale, duplicated, misplaced or unsupported items, and lineage from source to answer. Profile: [`packages/pi-package/profiles/knowledge.yaml`](packages/pi-package/profiles/knowledge.yaml).
- **Twin.** A memory per person, split into a person scope (private by default) and role scopes (handed to a successor when the person leaves), with explicit, class-scoped, expiring grants. Profile: [`packages/pi-package/profiles/twin.yaml`](packages/pi-package/profiles/twin.yaml).
- **Distill.** Procedures mined from agent sessions, admitted only after replay validation on held-out tasks, retired when they drift. The session recorder is built (card D1); induction (D2) and the replay gate (D3) are next.

**Where it runs.** Engram is built on [pi](https://pi.dev) (ADR [0001](docs/decisions/0001-pi-as-base.md)). Inside pi, the Engram extension intercepts writes in pi's `tool_call` handler and reads in its `context` handler, mirrors every decision into the pi session as a custom entry, and blocks shell commands and file tools that would reach a store directly. Claude Code and Codex reach the same plane through an MCP server, and Claude Code also gets a PreToolUse hook that blocks direct store access. A CLI, a loopback HTTP API and a browser inspector sit beside them. No surface holds policy logic: each one calls core.

## Why it exists

Telling a model the rules ("do not reveal another user's notes") is a request, not a guarantee. Engram enforces the rules in code, before the model sees anything, and records why. The thesis measures what that costs.

The novelty claim, exactly as card R3 restated it in [`docs/research/positioning.md`](docs/research/positioning.md):

> To our knowledge, Engram is the first deterministic, event-logged, replayable control plane across memory stores, with a pre-registered measurement of its governance tax.

Each word is a condition, and the claim is only as strong as the weakest:

- **Deterministic.** Every decision is a pure function of the typed policy, the actor, the item and the time, evaluated by code. No model makes a decision or sets a trust-bearing input: the provenance kind and the actor come from the harness, and the scope, class and confidence a writing agent chooses are checked against the policy.
- **Event-logged.** Every decision is a `MemoryEvent` with a reason and a policy id, and the log is the source of truth.
- **Replayable.** State is rebuilt from the log alone (except items later erased by offboarding, which never come back), and a recorded workload replays every decision under any policy. A single decision cannot be decided again from events alone, because a denied write's event carries no item and a read's event carries no query (ADR [0032](docs/decisions/0032-simulator-replays-recorded-calls.md)).
- **Across memory stores.** One adapter contract, one conformance suite, three adapters. Store independence is a design property (ADR [0035](docs/decisions/0035-store-independence-is-a-design-property.md)); the request-identity check meant to prove it is not built yet, and the registered H1 runs use one store, Mem0.
- **Pre-registered measurement of its governance tax.** H1 and H2 register the cost of enforcement before any run. The analysis is to be tagged `prereg-v1` and deposited before the first run (ADR [0023](docs/decisions/0023-preregistration-in-repo.md)); today only `prereg-v0` is tagged, and nothing has run. The claim is about what is registered, not about a result.

What the claim no longer says: "the first governance layer over existing stores" (HEAMS, arXiv 2611.20144, ships one), "the first measured governance tax", "the first to log each decision with its reason", and "the first deterministic policy on memory reads" (withdrawn in October; HEAMS offers deterministic rules too). The positioning document gives the evidence for each withdrawal and compares Engram with HEAMS and SAFE-Mem (arXiv 2610.22959) row by row.

## How it fits together

```
 Agents and harnesses    pi (extension loaded)   Claude Code, Codex (MCP, hook)   CLI   any HTTP client
                                   \                     |                        |        /
 Surfaces                pi-extension          mcp           cli          server (HTTP API) + ui (inspector)
                                   \                     |                        |        /
 Engram plane                packages/core: schema, event log, policy engine, lints, explain,
                             replay, simulator, offboarding, no-bypass checks
                                                         |
 Adapters                    packages/adapters: files (Claude Code memory), Mem0, Letta MemFS
                                                         |
 Stores                      unchanged
```

Two rules keep this buildable by four people and their coding agents: logic lives only in `packages/core` and `packages/adapters`, and the schema in `packages/core/src/schema.ts` is the contract from which JSON Schema, the OpenAPI document, the TypeScript client and the Python types are generated (`make api`). The full design, with the write path, the read path, retention, lifecycle and every interface, is [`docs/architecture.md`](docs/architecture.md).

## Status, 2026-11-21

The project started on 5 October 2026 and submits in the last week of March 2027 ([`docs/roadmap.md`](docs/roadmap.md)). It is in week 7, phase 2 ("First result"). A *gate* is a go or no-go checkpoint with written criteria; there are four, A to D. Gate A was declared passed with two exceptions on 2026-10-29 ([log](docs/log/2026-10-29-gate-a-milestone-corrected.md)); Gate B's engineering was done the same day and proposed as passed with exceptions that wait on the pre-registration ([log](docs/log/2026-10-29-gate-b-engineering-done.md)).

**What works, merged on main.**

- The plane: write gate, read filter, event log on SQLite and Postgres, explain, replay, retention and budgets, promotion, grant changes, offboarding with a deletion report (a core function; no surface calls it yet), adoption of what a store already holds, the commit protocol that keeps two processes on one log from undoing an erasure, and the no-bypass checks.
- Three adapters, files (Claude Code's memory folder), Mem0 (open source, in process) and Letta MemFS (a git repository), behind one contract and one conformance suite.
- Every surface: the pi extension and the pi package, the MCP server over stdio or loopback HTTP, the Claude Code hook, the `engram` CLI, the HTTP API with its generated OpenAPI document and client, and the inspector (scope lanes, timeline, explain view, the twin screens with a grants editor).
- Lints L1 to L4: the deterministic tier (with E2.10's injection-signature lint), the seeded-fault generator, the model-based tier (contradiction, unsupported claim) and the lint evaluation.
- The simulator, and three policy presets (strict, medium, permissive) plus the Knowledge and Twin profiles.
- Benchmark harnesses through the plane: GateMem, LongMemEval and MEM-INV-Bench in TypeScript; MERIT and tau2-bench run unmodified as external Python processes through the cassette proxy (card B10), so their model calls are cached and seeded too.
- The experiment runner: conditions C1 to C5 as pi SDK sessions, cassettes, live and replay modes, resume, shards and spend ceilings.
- The review cards RV1 to RV8, the November literature review (111 notes, [`docs/readings/litreview/`](docs/readings/litreview/README.md)) and the absorb plan ([`docs/tasks/absorb-plan.md`](docs/tasks/absorb-plan.md)): thirty pull requests, chosen on 2026-11-21, that take in what is worth taking from open-source projects and recent papers.
- All fifteen of the absorb plan's first pull requests, merged on 2026-11-21:
  - R2: the proposed arms, written as proposals in the pre-registration's [section "Proposed amendments, not yet registered"](docs/research/preregistration.md#proposed-amendments-not-yet-registered), with the baseline matrix in [`docs/research/baselines.md`](docs/research/baselines.md);
  - R3: the novelty claim restated against its nearest neighbours ([`docs/research/positioning.md`](docs/research/positioning.md));
  - R4: the claims crosswalk ([`docs/compliance/`](docs/compliance/README.md));
  - E2.7: characterisation tests of two suspected trust gaps, both confirmed;
  - E2.8: the policy schema for content guards and trust floors;
  - E2.9: the secret and personal-data guard at the write gate (deny or hold as a candidate, the reason naming only the kind and the length);
  - E2.10: the deterministic injection screen (an instruction to the agent in content a person did not type is held as a candidate), reported as a floor with its escape and false-hold rates;
  - A5: conformance cases for capability claims, and a revocation grid per store;
  - E1.4: a stateful model-based test of the Plane, with crash windows;
  - E1.5: a Quint model of the commit and erasure protocol ([`specs/`](specs/README.md));
  - B10: the cassette proxy; B7: MERIT; B11: tau2-bench;
  - D1: the session recorder;
  - X15: the plane's latency against bare SQLite, with a proposed budget.

  E2.9's and E2.10's guards are off by default and in every registered preset. The answers card carried decisions 1 to 59 into the pre-registration the same day.

**In progress.** The absorb plan's cards 16 to 30, started on 2026-11-21 (listed under [What is next](#what-is-next)); none has merged.

**What is measured.** Only offline results so far, each regenerated by a script from a config and listed in [`research/results/MANIFEST.md`](research/results/MANIFEST.md): what the plane admits on GateMem and MEM-INV-Bench, the H4 power simulation, the deterministic lint floor on LongMemEval's memory, the seeded-fault set, the cost table, the label-audit draws, the claims crosswalk, the injection screen's corpus run (`h1-injection-screen.json`), the secret guard's in-sample rate (`h1-secret-guard.json`) and the plane's latency budget (`h2-perf-budget.json`). For example, all registered runs together are estimated at 1,159 to 5,227 dollars at OpenRouter's list prices ([`research/results/h2-cost-table.json`](research/results/h2-cost-table.json), the `decided` block). No live model result exists yet.

**What is pending.** The label audit (23 to 28 November), the `prereg-v1` tag and its Zenodo deposit (by 30 November), and then H1's live runs (from 1 December).

**Known limits, stated rather than hidden.**

- Identity is self-asserted: `--as` and `--member` are taken as given, and the HTTP and MCP surfaces listen on loopback only with no authentication (ADR [0027](docs/decisions/0027-http-contract-client-and-inspector.md); card E8.12 is the fix).
- The event log is append-only by convention, not tamper-evident (ADR [0038](docs/decisions/0038-tamper-evident-log-that-keeps-erasure.md); card E1.6 builds the chain).
- Within what a rule admits, a less trusted co-member can rewrite, retire or evict a more trusted item; card E2.7's tests pin this (GH-38), and card E2.11 is the opt-in fix, in progress.
- A caller that sends no source, such as an HTTP client or a library call, is taken at the provenance kind it claims, so it can write as `user`. E2.7 confirmed this as GH-39; card E2.11's trust floor is the opt-in fix, in progress.
- Outside pi the guarantee is weaker: MCP reads are filtered by scope and grants, but nothing governs what the harness already holds in its context (condition C7), and Codex has no hook (ADR [0022](docs/decisions/0022-other-harnesses-through-mcp.md)).
- `Plane.distill` is not implemented (card D2), and condition C6 (enforcement with lints) is not built in the runner yet.

## Quick start

You need Node 24 or later, [pnpm](https://pnpm.io) and [uv](https://docs.astral.sh/uv/), and git on the path for the Letta adapter. No Docker, and no model key: everything below runs offline.

### 1. Install and test

The `engram` command is `packages/cli/src/main.ts`. From a clone, run it as `node packages/cli/src/main.ts <command>` or `make engram ARGS="<command> ..."`. The examples below write `engram` for short; to type them as written, run this once in the clone's root:

```sh
alias engram="node $PWD/packages/cli/src/main.ts"
```

```sh
git clone <this repository> engram && cd engram
pnpm install && uv sync
make test
make engram ARGS="doctor"
```

`make test` runs vitest (core, adapters, conformance on fakes, replay) and pytest (research). Core's log tests also run on a throwaway embedded Postgres; `ENGRAM_PG=skip` skips them. `engram doctor` checks the log, the policy, the adapters (a write and a read through the plane on Mem0 and on Letta, offline), the provider keys by name only, the benchmark pins and fixture hashes, the pi pin and Node, and never creates a log.

### 2. Write, read and explain on a temporary folder

```sh
mkdir -p /tmp/engram-demo/memory
engram write --root /tmp/engram-demo/memory --owner alice --db /tmp/engram-demo/engram.db \
  --content "The deploy key rotates every 90 days."
engram read deploy --root /tmp/engram-demo/memory --owner alice --db /tmp/engram-demo/engram.db
```

The write prints its decision, its rule and its reason:

```
allow: semantic item from source user passes the person write rule; provenance set by the plane: source user, actor person:alice
policy preset.medium/write/person
```

The read prints each returned item with its score components and admitting rule, and ends with the command that explains it:

```
1. 01a1fe83-...  semantic  person:alice
   score 2.9000 = relevance 1.0000 + confidence 0.9000 + recency 1.0000
   admitted by preset.medium/read/person
```

```sh
engram explain <read id> --owner alice --db /tmp/engram-demo/engram.db
```

Now try someone else:

```sh
engram read deploy --root /tmp/engram-demo/memory --owner alice --db /tmp/engram-demo/engram.db --as person:bob
engram write --root /tmp/engram-demo/memory --owner alice --db /tmp/engram-demo/engram.db \
  --as person:bob --scope person:alice --content "x"
```

The read as bob returns nothing and counts one item out of his reach; the write as bob into `person:alice` is denied with `policy engram/write/membership` and exits 1. Every one of these is an event in the log.

### 3. The HTTP API and the inspector

```sh
make ui              # build the inspector once, into packages/ui/dist
engram serve --root /tmp/engram-demo/memory --owner alice --db /tmp/engram-demo/engram.db \
  --as person:alice --member person:alice
```

Then open `http://127.0.0.1:7313/` for the inspector and `http://127.0.0.1:7313/api/v1/health` for the API. The server binds to loopback only and refuses any other host. Other commands can talk to it with `--server http://127.0.0.1:7313`.

### 4. Claude Code and Codex, through MCP

`engram mcp` serves the tools `memory_write`, `memory_read`, `memory_explain` and `memory_simulate` over stdio, every call as one fixed actor with source `model`. Working configurations are in [`fixtures/harness/`](fixtures/harness/README.md):

- Claude Code: [`claude-code/.mcp.json`](fixtures/harness/claude-code/.mcp.json) for the server, and [`claude-code/.claude/settings.json`](fixtures/harness/claude-code/.claude/settings.json) for the PreToolUse hook `engram hook claude-code`, which denies shell commands and file tools that would touch the store or the log.
- Codex: [`codex/config.toml`](fixtures/harness/codex/config.toml), MCP only.

The fixtures call `engram`; put the CLI on your path, or replace `engram` with `node <clone>/packages/cli/src/main.ts`. `make test-e2e` runs both handshakes (it builds the inspector with `make ui` and needs Chromium, `pnpm exec playwright install chromium`).

### 5. pi, with the extension

```sh
npm i -g @earendil-works/pi-coding-agent@1.3.0
pi                   # in the clone; accept project trust once
```

The repository's [`.pi/settings.json`](.pi/settings.json) loads the Engram pi package ([`packages/pi-package`](packages/pi-package/README.md)), so the session gets the memory tools, the `engram` skill and the `/engram` prompt template. The package reads `ENGRAM_ROOT`, `ENGRAM_STORE`, `ENGRAM_POLICY`, `ENGRAM_OWNER`, `ENGRAM_AS`, `ENGRAM_MEMBER` and `ENGRAM_DB_URL`; by default the store is `.engram/memory` in the project, the log is `<home>/.engram/engram.db`, and the actor is `person:<your login>`.

## Common commands

A selection, grouped. [AGENTS.md, "Commands"](AGENTS.md#commands) is the full list, and `make help` and `engram --help` print what is installed.

| task | command |
|---|---|
| install once | `pnpm install && uv sync` |
| all tests | `make test` |
| one test file | `make test-one T=<path>` |
| the invariants against the real Plane | `make test-invariants` |
| lint code and docs | `make lint`, `make lint-docs` |
| end to end (CLI, MCP, hook, inspector in Chromium) | `make test-e2e` (it runs `make ui` itself; once first: `pnpm exec playwright install chromium`) |
| regenerate the contracts and clients | `make api`; `make api-check` fails on a diff |
| the Quint model of the commit protocol | `make verify-spec` (Quint through npx, fetched on first use; Apalache's bounded check only with a JVM on the path) |
| the CLI | `engram write \| read \| promote \| explain \| retain \| lint \| simulate \| serve \| mcp \| hook claude-code \| doctor` |
| a benchmark on its fixture subset, offline | `make bench BENCH=gatemem` (also `longmemeval`, `merit`, `tau2`; MERIT and tau2 fetch their pinned harness once) |
| replay a runner config from its cassettes | `make run CONFIG=research/configs/rn1-gatemem-probe.json` |
| count a run's sessions, no model called | `make run CONFIG=research/configs/h1-gatemem.json COUNT=1` |
| rerun every committed result and compare hashes | `make test-repro` |
| consolidate the log into thesis drafts | `make thesis` |

## The research programme

The question: what does enforcing memory governance at the boundary cost, compared with asking the model to behave, across stores and models? The design is registered in [`docs/research/preregistration.md`](docs/research/preregistration.md) (v1, answered, untagged until its pre-tag conditions hold).

**Hypotheses.** Holm adjusts the five primary p-values at a family-wise alpha of 0.05.

| | statement, in one line | conditions | benchmarks |
|---|---|---|---|
| H1 | Enforcement beats instruction: C5 leaks less than C3 and C4 on the primary model. | C2 to C5 | GateMem, MEM-INV-Bench |
| H2 | The governance tax has a knee: a preset keeps at least 90 percent of ungoverned utility with at most 20 percent of its violations. | C1, C2, C5 | GateMem, LongMemEval, MERIT |
| H3 | Lints recover part of the utility enforcement loses, at matched token budget. | C5, C6 | LongMemEval |
| H4 | Under enforcement the violation rate does not depend on the model (equivalence within 5 points); store independence is a design property. | C2, C5 | GateMem |
| H5 | Procedures admitted only after replay validation raise task success over the same procedures admitted ungoverned. | C1, C2, C5 | tau2-bench |

**Conditions.** How memory reaches the agent; the runner states each one's mechanism in `CONDITION_TABLE` (`packages/runner/src/config.ts`).

| id | name | memory path |
|---|---|---|
| C1 | no memory | long context only |
| C2 | ungoverned | the store directly |
| C3 | instruction | the store directly, with the policy as text in the system prompt |
| C4 | instruction with metadata | as C3, and each read item carries metadata for the model to decide from |
| C5 | enforced | the Engram plane: write gate and read filter, before the model call |
| C6 | enforced with lints | as C5, plus the preset's lints (not built in the runner yet) |
| C7 | governed tools without read filtering | the Engram tools over MCP; run by no hypothesis since 2026-11-20 |

**Benchmarks**, each pinned to one upstream commit in [`packages/bench/PINS.md`](packages/bench/PINS.md): GateMem (2,218 checkpoints), MEM-INV-Bench (38 laundering-channel cases), LongMemEval (500 questions, cleaned S split), MERIT, MemoryAgentBench (pinned, run by no hypothesis) and tau2-bench (v1.0.1).

**Models**, chosen by the lead on 2026-11-20, all through OpenRouter on a seeded API: M1 DeepSeek v4 pro (primary), M2 GLM 5.3 Flash and M3 Mistral Large 4 (fixed subsets). Three seeds. Every model call is cached on (benchmark item, condition, preset, store, model, seed, prompt hash), so a rerun makes zero new calls (ADR [0017](docs/decisions/0017-cached-metered-seeded-model-calls.md)). H1 is 26,616 GateMem sessions and 456 MEM-INV-Bench sessions on M1, as `make run ... COUNT=1` counts them.

**Where results live.** A result exists only if `research/scripts/<name>.py` regenerates it from `research/configs/` into `research/results/`, with a row in [`research/results/MANIFEST.md`](research/results/MANIFEST.md) (AGENTS.md rule 9). [`research/README.md`](research/README.md) explains how to reproduce one.

## Repository map

| path | what |
|---|---|
| [`packages/core`](packages/core/README.md) | the plane: schema, events, policy, lints, explain, replay, simulator, offboarding. No store I/O, no model calls |
| [`packages/adapters`](packages/adapters/README.md) | files, Mem0, Letta; each implements the Adapter contract; the conformance suite |
| [`packages/pi-extension`](packages/pi-extension/README.md) | the Engram pi extension: tools, `tool_call` and `context` handlers, custom entries, session replay |
| [`packages/pi-package`](packages/pi-package/README.md) | the distributable pi package: extension, skill, prompt template, profiles |
| [`packages/mcp`](packages/mcp/README.md) | the MCP server for Claude Code and Codex; the Claude Code hook |
| [`packages/tag`](packages/tag/README.md) | the memory tag and the memory_write and memory_read definitions, pure, no pi |
| [`packages/kit`](packages/kit/README.md) | the framework kit: a fixed actor, a namespace to scope mapper, a typed rejection; the adapter conformance suite |
| [`packages/ai-sdk`](packages/ai-sdk/README.md) | `@engram/ai-sdk`: governed recall as a Vercel AI SDK middleware, remember and recall tools |
| [`packages/cli`](packages/cli/README.md) | the `engram` command |
| [`packages/server`](packages/server/README.md) | the HTTP API (loopback only), its route table, the workspace opener |
| [`packages/ui`](packages/ui/README.md) | the inspector, on the generated client |
| [`packages/view`](packages/view/README.md) | the pure view logic the inspector and the TUI share, with no React |
| [`packages/bench`](packages/bench/README.md) | benchmark harnesses through the plane, pinned in `PINS.md` |
| [`packages/runner`](packages/runner/README.md) | the experiment runner: conditions as seeded, cached pi SDK sessions |
| [`packages/model`](packages/model/README.md) | the cached, seeded model call, the scripted models and the cassette proxy |
| [`research/`](research/README.md) | Python: configs, scripts, results, analysis, thesis drafts |
| [`specs/`](specs/README.md) | the Quint model of the commit and erasure protocol |
| `sdk/` | generated JSON Schema, OpenAPI and TypeScript client; do not edit |
| [`docs/`](docs/README.md) | architecture, roadmap, decisions, tasks, research, readings, log, conventions |
| [`fixtures/`](fixtures/) | sessions, stores, faults, cassettes (recorded model replies, replayed so a rerun calls no model), benchmark subsets; regenerated only by `make fixtures` |
| [`scripts/`](scripts/) | the repository's own checks: `make lint-docs` (prose, log entries, the PR gate) and their tests |
| [`test/e2e/`](test/e2e/) | layer 6, `make test-e2e`: the CLI, the MCP handshakes, the hook and the inspector in Chromium |
| [`.pi/`](.pi/) | pi's project settings (loading the Engram package), the appended system prompt and the prompt templates for working on this repository |
| [`.claude/`](.claude/) | Claude Code's settings and commands for working on this repository |
| [`.github/`](.github/) | the PR template |
| [`AGENTS.md`](AGENTS.md) | the operating manual; `CLAUDE.md` is a checked copy |

## Contributing

Read [`AGENTS.md`](AGENTS.md) in full first: its rules are binding on people and coding agents alike. A new team member then reads the required tier of [`docs/readings/README.md`](docs/readings/README.md) and writes a note per paper, then [`docs/decisions/0001-pi-as-base.md`](docs/decisions/0001-pi-as-base.md) and [`docs/architecture.md`](docs/architecture.md). In short:

1. **Work is cut into task cards** under [`docs/tasks/`](docs/tasks/), each with a goal, the files it may touch, its dependencies, an acceptance command and what is out of scope. One card per pull request; its title is the card id and goal. Start only when every card it depends on is merged.
2. **Plan, test first, implement.** Propose the plan in the PR description, write the acceptance test before the code, and follow [`docs/conventions/testing.md`](docs/conventions/testing.md): fakes not mocks, scripted or cassette models, an injected clock and seeds.
3. **Log every step.** Each PR adds an entry under [`docs/log/`](docs/log/) in the format of [`docs/conventions/documentation.md`](docs/conventions/documentation.md), failures included; `make thesis` turns the log into chapter drafts.
4. **Keep the rules.** Policy logic only in core; stores only through `Plane.read` and `Plane.write`; no em dashes; a new dependency gets a row in [`docs/deps.md`](docs/deps.md); absorbed open-source code follows [`docs/conventions/absorption.md`](docs/conventions/absorption.md).
5. **Pass the gates locally:** `make lint`, `make lint-docs`, `make test` and the card's acceptance command, then open the PR with [the template](.github/PULL_REQUEST_TEMPLATE.md) filled in.

A choice another card could have made differently gets an ADR under [`docs/decisions/`](docs/decisions/README.md) (0001 to 0041 so far).

## What is next

- **By 30 November.** The label audit of H1's benchmarks by three members, the runner's remaining pre-tag work, the smoke run and the GateMem reference check (B1), then the `prereg-v1` tag and its Zenodo deposit. The eight pre-tag conditions are listed at the head of the pre-registration.
- **1 to 8 December.** H1's live runs on M1: GateMem as four shards in parallel, then MEM-INV-Bench, then `make h1-table` and `make h1-figure`.
- **13 December, Gate C.** If enforcement beats instruction, the programme continues as planned; if not, the thesis pivots to where boundary enforcement fails and why; an undecided read-out continues and lets the final Holm decide.
- **The remaining fifteen absorb cards, in progress** since 2026-11-21 and worked beside the live runs: L5 (near-duplicate lint), L6 (supersession helper), D2 (induction with Agent Workflow Memory, skills as SKILL.md) and D3 (the replay validation gate), E2.11 (trust floors), E1.6 (tamper-evident log), L7 (a local NLI tier for the contradiction lint), X14 (red-team harness), then the product lane: E2.13 (who can read this memory), E8.11 (provenance graph, event table and version diff in the inspector), E9.8 (memory import and export), E2.12 (policy exported to Cedar), E8.12 (verified actors), E8.13 (OpenTelemetry export) and E8.14 (a framework kit and a Vercel AI SDK middleware).
- **24 January 2027, Gate D.** The frontier figure on at least two policy levels, two stores (met by the request-identity check of ADR 0035, not by paid runs on each store) and two models, lint precision and recall on the seeded faults, and the Knowledge and Twin profiles on the team's own dogfood data with zero recorded violations ([`docs/dogfood.md`](docs/dogfood.md)).
- **February and March.** H3 and H5, failure analysis, the reproduction script, the thesis and its defence.

## Licence and attribution

The code is licensed under the Apache License 2.0 ([`LICENSE`](LICENSE), ADR [0020](docs/decisions/0020-licence.md)); the licence of the thesis text and figures is not decided yet. [`NOTICE`](NOTICE) carries the notices that copied code requires, [`docs/absorbed.md`](docs/absorbed.md) registers every copy or port with its source, commit and licence (ADR [0037](docs/decisions/0037-absorbing-open-source.md)), and [`docs/deps.md`](docs/deps.md) lists every dependency with its reason and licence. Benchmark data keeps its own licence, recorded in `packages/bench/PINS.md`.

The thesis methods chapter states that implementation used coding agents under the conventions in `AGENTS.md`, that experiment code and analysis were hand-reviewed, and that every generated component carries tests.

The team is four members on two tracks: the platform track owns adapters, surfaces, profiles and dogfood; the research track owns the policy engine, lints, benchmark harnesses, experiments and the thesis. The lead integrates.

## Links

- [`AGENTS.md`](AGENTS.md): the operating manual, the rules and every command
- [`docs/architecture.md`](docs/architecture.md): the design
- [`docs/roadmap.md`](docs/roadmap.md): phases, gates, weeks and task cards
- [`docs/research/preregistration.md`](docs/research/preregistration.md) and [`docs/research/positioning.md`](docs/research/positioning.md): the registered design and the novelty claim
- [`docs/decisions/`](docs/decisions/README.md): the ADRs
- [`docs/glossary.md`](docs/glossary.md): terms, and how they map to the papers'
- [`docs/compliance/`](docs/compliance/README.md): which test backs which claim, and which legal obligation it bears on
- [`docs/brand/`](docs/brand/README.md): the logo kit
- [pi](https://pi.dev): the harness Engram is built on
