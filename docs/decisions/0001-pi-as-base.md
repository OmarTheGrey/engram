# ADR 0001: pi is the base building block of the control plane

Status: accepted, 2026-10-17
Deciders: Omar (lead)
Supersedes: the Python-first core in the roadmap (cards E0.1, E0.3, E8.1, E8.3)

## Context

Engram needs four things from a harness: a place to intercept every memory write and read, a model-agnostic way to call any model for the parts that need one (model-based lints, the distiller, the agents under test), a durable record of what an agent did so procedures can be mined from it, and a way to run thousands of seeded, cached benchmark sessions across providers. The roadmap assumed a Python core with FastAPI and treated harnesses (Claude Code, Codex) as integration targets reached through hooks and MCP.

pi (`@earendil-works/pi-coding-agent`, 1.0, October 2026) provides all four as first-class, documented surfaces:

- Extension events `tool_call` (mutate or block a tool call), `tool_result`, `context` and `context_with_system` (transform messages before the model call), `before_agent_start` (change prompt sections, tools, or inject a message), `user_bash` (intercept shell commands), `session_start` and `session_shutdown`.
- `@earendil-works/pi-ai`: one API over subscription, API key, local and compatible endpoints; the session exposes a model runtime, and extensions can register providers and virtual models.
- A session file format: an append-only JSONL tree with `parentId` links, branching without deletion, `compaction` and `context_edit` entries, and `custom` entries (extension state, outside model context) and `custom_message` entries (extension-injected context). Version 3.
- An SDK: `createAgentSession()` with `customTools`, `extensionFactories`, `SessionManager` (file-backed or `inMemory()`), `model`, `scopedModels`, `cwd`, and `session.subscribe()` for `message_end`, `agent_end`, `agent_settled`.
- Pi Durable (experimental): `Harness`, `defineTask`, `defineTool`, `defineExtension`, `hook`, storage in memory, SQLite or JSONL, checkpointed tasks that resume after a crash, exactly-once submissions by `requestId`, `thread.watch()` streaming committed operations.
- Distribution: pi packages (npm or git) bundling extensions, skills and prompt templates; project-level `.pi/` directories; AGENTS.md as a context file; native MCP client.

## Decision

The plane is built on pi. Concretely:

1. **Language.** The plane (`packages/core`, `packages/adapters`) is TypeScript so it runs inside the pi process with no IPC on the write and read paths. Research code (analysis, statistics, figures, thesis) stays Python under `research/`.
2. **Interception.** The Engram pi extension registers the memory tools (`memory_write`, `memory_read`, `memory_explain`, `memory_simulate`) and runs the write gate in `tool_call` and the read filter in `context` and `before_agent_start`. Store CLIs invoked through `bash` are blocked in `user_bash` and `tool_call` so no write bypasses the gate.
3. **Model access.** `packages/core` never imports pi-ai. The extension builds a `ModelCall` from the session's model runtime and injects it into model-based lints and the distiller. The same `ModelCall` type is what the runner uses to drive agents under test, so every model call in the project goes through pi-ai and is cached by Engram.
4. **Event log.** Engram keeps its own append-only MemoryEvent log in SQLite (Postgres later) as the source of truth. Every decision is mirrored into the pi session as a `custom` entry (`customType: "engram.event"`). Explanations the policy allows the model to see are `custom_message` entries. Replay-from-events reconstructs any item's history from either source.
5. **Episodic memory.** The pi session tree is the raw episodic record. The distiller reads session JSONL: successful leaves are positive evidence, abandoned branches and `branch_summary` entries are negative evidence, `compaction` entries bound what was in context.
6. **Runner.** Benchmarks and experiments run as pi SDK sessions (`createAgentSession` with `SessionManager.inMemory()` for speed or JSONL for fixtures), with the Engram extension loaded or not depending on the condition, and the model swapped by config. Pi Durable is adopted for the parallel, checkpointed experiment runner behind `ENGRAM_RUNNER=durable`; the default runner is a plain queue over the SDK so no card blocks on an experimental API.
7. **Surfaces.** The pi extension and pi package are the primary product surface. The MCP server serves Claude Code and Codex with the same governed tools. The inspector talks to a thin HTTP server over the same core. pi's RPC mode is used for the inspector's live session view.
8. **Harness-agnostic claim (H4).** Store- and model-agnostic is demonstrated through pi-ai providers; harness-agnostic is demonstrated by the MCP path into Claude Code and Codex, where interception is weaker (no `context` event) and the thesis says so.

## Mapping

| Engram component | pi building block |
|---|---|
| write gate | `tool_call` handler on Engram tools and MCP store tools; block or mutate |
| read filter and retrieval explanation | `context` transform; `before_agent_start` to inject governed recall with its explanation |
| no-bypass guarantee | `user_bash` and `tool_call` block known store commands |
| MemoryEvent log mirror | `custom` entries, `customType: "engram.event"` |
| explanations shown to the model | `custom_message` entries |
| episodic record for Distill | session JSONL tree, branches, `branch_summary`, `compaction` |
| any model, any provider | pi-ai through the session model runtime; `registerProvider`, `registerVirtualModel` |
| model-based lints, distiller | `ModelCall` injected at the boundary, built on pi-ai, seeded and cached |
| policy simulator | replay a session JSONL through the plane with a candidate policy; zero model calls |
| experiment runner | SDK sessions, in-memory session manager, `scopedModels`; Pi Durable `Harness` and `defineTask` behind a flag |
| slash commands | `registerCommand`: `/engram explain`, `/engram lint`, `/engram simulate`, `/engram policy` |
| distribution | pi package with extension, skills and prompt templates; `.pi/` in this repo |
| other harnesses | MCP server; Claude Code hooks for the write gate; Codex through MCP only |

## Consequences

- Cards E0.1, E0.3, E8.1, E8.3 are rewritten: pnpm workspace is primary, core interfaces are TypeScript, the HTTP server is thin, clients are generated from it. New cards: PX1 (Engram pi extension skeleton with `tool_call` and `context` handlers), PX2 (session custom entries and replay), PX3 (pi package and `.pi/` project setup), RN1 (SDK runner), RN2 (Durable runner behind flag).
- Adapter conformance tests run on fakes in vitest; the Python side has no adapters.
- The team learns one harness deeply instead of three shallowly. Everyone installs pi in week minus one and works in this repo through it.
- Gate A gains a check: the extension blocks a write to the files adapter from a pi session and the event appears in both logs.
- Risk: pi is young and moves fast. Mitigation: exact version pins, a vendored copy of `extensions/types.ts` for the events we use, and `packages/core` isolated from pi so a breaking change touches only `packages/pi-extension` and `packages/runner`.
- Risk: Pi Durable API churn. Mitigation: the flag, and no thesis result depends on it.
- Risk: the MCP path cannot filter context in Claude Code or Codex. Mitigation: stated as a limitation and measured as its own condition (governed tools without read filtering).

## Alternatives considered

- Python core with pi reached over MCP: two processes on the write path, no `context` interception, double the schema maintenance. Rejected.
- Build on Claude Code hooks as the base: hooks can block tool calls but cannot transform context, sessions are not a documented tree, model is fixed. Rejected.
- Own minimal harness: rebuilds what pi already ships and tests; no distribution channel. Rejected.

## Sources

- pi SDK: https://pi.dev/docs/latest/sdk
- pi extensions: https://pi.dev/docs/latest/extensions
- pi session format: https://pi.dev/docs/latest/session-format
- Pi Durable: https://earendil.com/posts/pi-durable/
- Pi 1.0: https://earendil.com/posts/pi-1-0/
