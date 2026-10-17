# Engram

The memory control plane for agentic AI. Engram sits between agents and the stores that hold their long-term memory, and enforces policy on every read and write: who may write what into which scope, who may read it back, how long it is valid, where it came from, and why a given recall happened. The store does not change. The model is never called by the plane.

Three products on one plane:

- **Govern.** Trusted organisational memory: provenance-grounded, temporally valid, conflict-linted, with lineage from source to answer.
- **Twin.** A memory per person, split into person and role scopes, with consent-scoped grants and a role that can be handed over.
- **Distill.** Procedures mined from agent sessions, admitted after replay validation, retired on drift.

And one research question: what does enforcing memory governance at the boundary cost, compared with asking the model to behave, across stores and models?

Engram is built on [pi](https://pi.dev): the plane runs inside the pi process as an extension, intercepts writes in `tool_call` and reads in `context`, mirrors every decision into the pi session, reaches any model through pi-ai, and mines procedures from pi session trees. Claude Code and Codex are reached through the MCP server. See `docs/decisions/0001-pi-as-base.md`.

## Status

Pre-week-zero. The repository holds the body of knowledge (`docs/`) and the conventions (`AGENTS.md`). Code starts with task card E0.1.

## Get in

1. Read `AGENTS.md`. All of it.
2. Read `docs/decisions/0001-pi-as-base.md`, then `docs/architecture.md`.
3. Install pi (`npm i -g @earendil-works/pi-coding-agent`), run `pi` in this repo once, accept project trust.
4. Read the required tier in `docs/readings/README.md` and write your notes.
5. `pnpm install && uv sync`, then `make test`.
6. Take a card from `docs/tasks/` that has no unmerged dependencies.

## Map

| Path | What |
|---|---|
| `packages/core` | the plane: schema, events, policy, lints, explain, distill. No pi imports, no model calls |
| `packages/adapters` | files, mem0, letta; each implements the Adapter contract |
| `packages/pi-extension` | the Engram extension: tools, `tool_call` and `context` handlers, commands, custom entries |
| `packages/pi-package` | the distributable pi package: extension, skills, prompt templates |
| `packages/mcp` | MCP server for Claude Code and Codex |
| `packages/bench` | benchmark runners on the pi SDK, pinned in `PINS.md` |
| `packages/runner` | experiment runner: seeded, cached pi SDK sessions; Pi Durable behind a flag |
| `packages/cli`, `server`, `ui` | surfaces; call core, hold no policy logic |
| `research/` | Python: configs, scripts, results, analysis, thesis |
| `sdk/` | generated clients; do not edit |
| `docs/` | architecture, decisions, tasks, research, readings, deps, glossary |

## Team

Four members, two tracks. Platform track owns adapters, surfaces, profiles and dogfood. Research track owns the policy engine, lints, benchmark harnesses, experiments and the thesis. The lead integrates.

## Licence

To be decided before the first external release. See `docs/decisions/`.
