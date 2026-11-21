# 12-frameworks: plugging Engram into agent frameworks (AB-FWK)

## Executive summary

Engram governs memory only for pi sessions and, through MCP, for Claude Code and Codex. Most agents in production run on a framework with its own memory seam. I read the interface each framework asks a store to implement, with star counts, licences and push dates checked by `gh api` on 2026-11-21. Three seams fit Engram well. LangGraph's `BaseStore` has one abstract method (`batch`) over namespaced JSON items. The Vercel AI SDK has a typed model middleware (`transformParams`, `wrapGenerate`, `wrapStream`). Mastra has a `Processor` pipeline with `processInput` and `processOutputResult`. Together they cover the Python graph world and the two big TypeScript worlds. All three can call the generated client (`@engram/sdk`, `createEngramClient`). Python adapters need a Python client generated from `sdk/openapi.json`. That is a small prerequisite, not a rewrite. Two server gaps block a faithful `BaseStore`: there is no get-by-key and no list-namespaces route, and a denied write needs a typed result on the client side. A shared TypeScript kit (AB-FWK-1) closes these once. The honest limit, as with ADR 0022: a framework adapter governs what passes through the seam, not state the framework keeps elsewhere (graph state, checkpointers, thread tables).

## Landscape (stars and push date from `gh api`, 2026-11-21)

| name | URL | licence | stars / last push | lang | interface Engram implements | absorb mode |
|---|---|---|---|---|---|---|
| LangGraph | github.com/langchain-ai/langgraph (JS: langgraphjs) | MIT | 45,222 / 2026-11-20 | Python and TS | `BaseStore.batch(ops)` and `abatch`; ops `GetOp`, `SearchOp`, `PutOp`, `ListNamespacesOp`. Checkpointers (`BaseCheckpointSaver`) are graph state, not governed | depend (peer dep), port semantics |
| LangChain JS | github.com/langchain-ai/langchainjs | MIT | 18,354 / 2026-11-20 | TS | legacy memory classes (not read; assumed superseded by LangGraph) | ideas only |
| LlamaIndex | github.com/run-llama/llama_index | MIT | 52,973 / 2026-11-20 | Python | `BaseMemoryBlock` with `_aget(messages, **kw)`, `_aput(messages)`, optional `atruncate`; fields `name`, `priority`, `accept_short_term_memory`; plugged into `Memory.from_defaults(memory_blocks=...)` | depend |
| CrewAI | github.com/crewAIInc/crewAI | MIT | 61,137 / 2026-11-21 | Python | `StorageBackend` Protocol: `save`, `search(query_embedding, scope_prefix, categories, metadata_filter, limit, min_score)`, `delete`, `update`, `get_record`, `list_records`, `get_scope_info`, `list_scopes`, `list_categories`, `count`, `reset`, `asave`, `asearch`, `adelete`. Its path-like scopes resemble Engram scopes | depend |
| AutoGen | github.com/microsoft/autogen | CC-BY-4.0 (docs, `LICENSE`) and MIT (code, `LICENSE-CODE`), verified | 61,955 / 2026-11-12 | Python | `autogen_core.memory.Memory`: `update_context(model_context)`, `query(query)`, `add(content)`, `clear()`, `close()`. The repo is ARCHIVED (README banner names a successor, microsoft/agent-framework, whose repo path returned 404 to `gh api`) | ideas only (archived, no adapter) |
| AG2 | github.com/ag2ai/ag2 | Apache-2.0 | 5,077 / 2026-11-21 | Python | new `ag2.knowledge` store (`read`, `write`, `list`, `delete`, `exists`, `append`, `on_change` over paths) in the `ag2/` package, not the legacy `autogen/` one; only the in-memory class was read | depend, low priority |
| OpenAI Agents SDK | github.com/openai/openai-agents-python, openai-agents-js | MIT | 30,793 and 4,031 / 2026-11-21 | Python and TS | `Session` Protocol: `session_id`, `get_items(limit)`, `add_items(items)`, `pop_item()`, `clear_session()`; optional `run_compaction`. History, not long-term memory | depend |
| Vercel AI SDK | github.com/vercel/ai | Apache-2.0 (npm `ai` 7.0.179 says Apache-2.0; GitHub shows NOASSERTION) | 28,117 / 2026-11-21 | TS | `LanguageModelV4Middleware` (`specificationVersion: 'v4'`) with `transformParams`, `wrapGenerate`, `wrapStream`; applied by `wrapLanguageModel` | depend (peer) |
| Mastra | github.com/mastra-ai/mastra | Apache-2.0 except `ee/` directories (not absorbable); GitHub shows NOASSERTION, npm `@mastra/core` 1.85.0 says Apache-2.0 | 29,714 / 2026-11-21 | TS | `Processor` (`processInput`, `processOutputResult`, `processInputStep`, tripwire). Heavy: `abstract MastraMemory` with about 13 abstract methods (`saveMessages`, `recall`, `getWorkingMemory`, `cloneThread`...) | depend |
| Pydantic AI | github.com/pydantic/pydantic-ai | MIT | 21,323 / 2026-11-21 | Python | `AbstractCapability` with hooks `before_run`, `before_model_request`, `wrap_node_run`, `on_tool_execute_error`, and tool wrappers. No memory store as such; a capability is the seam | depend |
| Google ADK | github.com/google/adk-python, adk-js | Apache-2.0 | 22,292 and 1,488 / 2026-11-21 | Python and TS | `BaseMemoryService`: `add_session_to_memory(session)`, `search_memory(app_name, user_id, query)`; optional `add_events_to_memory`, `add_memory`, `delete_memory`. TS: `addSessionToMemory`, `searchMemory(request)` | depend |
| Semantic Kernel | github.com/microsoft/semantic-kernel | MIT | 28,791 / 2026-11-20 | C# (Python too) | .NET `IMemoryStore` (`UpsertAsync`, `GetAsync`, `RemoveAsync`, `GetNearestMatchAsync`...); a VectorData connectors tree supersedes it (obsolete status not confirmed) | ideas only (.NET) |
| Letta clients | github.com/letta-ai/letta-node, letta | Apache-2.0 | letta 25,506 / 2026-10-18; letta-node 49 / 2026-11-21 | TS and Python | not a store interface: an HTTP client with `agents.blocks` (`retrieve`, `update`, `list`, `attach`, `detach`) and passages. Engram already has a Letta adapter, and a client wrapper would sit the other way round | already covered |

Python versus TypeScript: LangGraph, LlamaIndex, CrewAI, AutoGen, AG2, Pydantic AI are Python-first. Vercel AI SDK, Mastra, LangGraph JS, OpenAI Agents JS and ADK-JS are TypeScript, so those use `@engram/sdk` directly. The Python ones need a client generated from `sdk/openapi.json`. Generator licences, checked by `gh api`: `openapi-python-client` MIT (2,002 stars, pushed 2026-11-18) and `datamodel-code-generator` MIT (4,062 stars, pushed 2026-11-21); either is usable as a dev tool. Note `pyproject.toml` says the uv workspace is research only, so a `python/` member needs an AGENTS.md change in the same PR.

## What the server must offer (observed in `packages/server/src/routes.ts`)

Routes today: `/items` (write), `/items/check`, `/read` (text query, actor, optional `at`), `/explain/{readId}`, `/promote`, `/grants`, `/retain`, `/events`, `/policy`, `/lint`, `/simulate`, `/distill`, `/bypass`, `/viewer`, `/health`. Missing for a faithful key-value store: read an item by id or key, list scopes the actor may read, and a delete that maps to retirement. Writes of the same key must supersede rather than duplicate. Checked: `packages/core/src/plane/write.ts` evaluates a write against the projected item of the same id and refuses a stale one (`WRITE_CONFLICT_ID`), so same-id writes are updates, subject to policy and trust rules. A retire route does not exist; `retire` is only an event op used by retention and promotion, so who may retire an item is a new policy decision in core (see Verification).

## PR plans

### AB-FWK-1: Framework adapter kit and key-value routes
- goal: one TypeScript package, `@engram/framework-kit`, holding what every adapter repeats: a bound actor (fixed at construction, as the MCP server fixes it), a namespace-to-scope mapper, item mapping, a typed `Rejected` result carrying the event and reason, and the read tag from `packages/pi-extension/src/tag.ts`. Add server routes `GET /items/{id}`, `GET /scopes` and `POST /items/retire`, all calling core, then `make api`.
- absorbs: none; borrows semantics from the BaseStore, Session and BaseMemoryService interfaces above.
- files: `packages/framework-kit/` (new), `packages/server/src/routes.ts`, `packages/core` (a by-id read and retire surface if absent), generated `sdk/`.
- effort: M
- depends on: RV4 (merged). The schema rule (rule 5) applies if a field is added; keep the schema untouched.
- value: product, every later adapter is thin; thesis, one place where the C7-style limit is stated per framework.
- risks: rule 1, keep all policy decisions in core; the by-id read must apply the read matrix and grants and emit an event.
- acceptance: `make test-one T=packages/framework-kit/test/kit.test.ts` (fake workspace, the bound actor cannot be overridden, a denied write returns `Rejected` with the event).

### AB-FWK-2: `@engram/langgraph` and Python `engram-langgraph`, a governed BaseStore
- goal: a `BaseStore` subclass whose `batch` maps ops to the client. Python is primary (the larger user base, 45k stars); a JS twin follows from the kit.
- absorbs: LangGraph `BaseStore` (MIT, dependency only, peer range pinned).
- mapping: `PutOp(ns,key,value)` to `POST /items` with scope from `ns` (`("person","omar")` to `person:omar`, `("org",)` to `org`), id derived from `ns+key` so a repeat put supersedes; `value=None` to retire; `SearchOp(ns_prefix, query, filter, limit)` to `POST /read` with `text=query`, result `SearchItem.score` from the explanation's score components; `GetOp` to `GET /items/{id}`; `ListNamespacesOp` to `GET /scopes`; `supports_ttl=True` mapped to Engram's `ttl`. A denied put raises `EngramRejected` (event id, reason, policy id) unless `on_reject="record"`.
- files: `packages/langgraph-js/` (TS), `python/engram_langgraph/` (new uv workspace member), `sdk/python` (generated client, new), `docs/deps.md` rows, an example graph in `examples/langgraph/`.
- effort: L (the Python client generation is most of it)
- depends on: AB-FWK-1.
- value: product, a drop-in `store=EngramStore(...)` for the largest agent framework; thesis, a third harness row for H4 beyond pi and MCP.
- risks: checkpointers and graph state are ungoverned and must be documented; Python semantic search `index` embedding config is ignored (Engram ranks itself); async and sync both must work.
- acceptance: a conformance test that runs LangGraph's own store usage pattern (put, get, search, delete, list_namespaces) against an `EngramStore` over the fake workspace: `uv run pytest python/engram_langgraph/tests -q`, plus `make test-e2e` for a two-actor read-isolation case.

### AB-FWK-3: `@engram/ai-sdk`, Vercel AI SDK middleware
- goal: `engramMemory({ client, actor, scopes })` returning a `LanguageModelV4Middleware`.
- absorbs: Vercel AI SDK middleware API (Apache-2.0 per LICENSE file, peer dependency on `@ai-sdk/provider`).
- behaviour: `transformParams` takes the last user text, calls `POST /read`, prepends admitted items as a tagged system message (items escaped as in `tag.ts`), and stores the read id in `providerOptions` so the explanation is retrievable; `wrapGenerate` and `wrapStream` (on finish) write only through an explicit set of `memory_write`-style tools exported as `engramTools()` from the shared MEMORY_* definitions, so rule 4 holds (no model call in the plane). Post-hoc extraction is out of scope and would need an injected `ModelCall`.
- files: `packages/ai-sdk/` (new), `docs/deps.md`, `examples/ai-sdk/`.
- effort: S to M
- depends on: AB-FWK-1.
- value: product, the fastest demo path (a `wrapLanguageModel` call); thesis, a read-filter-at-the-prompt condition measured the same way as C7.
- risks: the spec version changed between majors, so test against two (peer range pinned); the middleware cannot stop other tools writing elsewhere.
- acceptance: `make test-one T=packages/ai-sdk/test/middleware.test.ts` using the AI SDK's `MockLanguageModelV4` (name to be verified in the package) and an in-process Engram app via `fetch` binding.

### AB-FWK-4: `@engram/mastra`, a governor Processor and a MastraMemory wrapper
- goal: step one, an `EngramGovernor` implementing `Processor` (`processInput` recalls, `processOutputResult` writes, tripwire on a mandatory-write denial). Step two (separate PR), a `GovernedMemory extends MastraMemory` that delegates thread methods to an inner `Memory` and routes `recall` and `updateWorkingMemory` through the plane.
- absorbs: Mastra (Apache-2.0; peer dependency; never vendor anything under `ee/`).
- mapping: resource id to person scope, thread id to provenance ref, working memory to one keyed item per resource.
- files: `packages/mastra/`, `docs/deps.md`.
- effort: M (step one), L (step two)
- depends on: AB-FWK-1.
- value: product, the second TypeScript framework, with 29k stars; thesis, the "processor versus store" comparison shows how much governance a read-only seam achieves.
- risks: processor and memory APIs change quickly; the `ee/` licence carve-out; heavy abstract surface.
- acceptance: `make test-one T=packages/mastra/test/governor.test.ts` driving the processor with a fake `MessageList`.

### AB-FWK-5: Session and context adapters for OpenAI Agents SDK, ADK and LlamaIndex
- goal: three thin adapters from the kit: `EngramSession` (OpenAI Agents Python and JS `Session`, only for promoted items), `EngramMemoryService` (ADK-JS `BaseMemoryService`, with `addSessionToMemory` feeding the Distill route), and `EngramMemoryBlock` (LlamaIndex `BaseMemoryBlock`).
- absorbs: those interfaces as dependencies (MIT, Apache-2.0, MIT).
- files: `packages/openai-agents/`, `packages/adk/`, `python/engram_llamaindex/`.
- effort: M each, one PR each
- depends on: AB-FWK-1; the LlamaIndex block also needs the Python client from AB-FWK-2.
- value: breadth; thesis, little.
- risks: sessions are conversation history, so governing every turn is slow and meaningless as memory; limit to promotion.
- acceptance: one test file per adapter, run with `make test-one`.

### AB-FWK-6: `engram-crewai` StorageBackend
- goal: implement CrewAI's `StorageBackend` Protocol, with CrewAI's `scope_prefix` mapped to Engram scope paths.
- absorbs: CrewAI Protocol (MIT, dependency only).
- files: `python/engram_crewai/`.
- effort: M
- depends on: AB-FWK-2's Python client.
- value: CrewAI has 61k stars; the vector-search signature (`query_embedding`) does not fit Engram's text-query read, so this adapter must embed or ignore it, which weakens the governed-ranking claim.
- risks: the embedding mismatch; mark the ranking as not Engram's.
- acceptance: CrewAI's own storage test pattern against the adapter, `uv run pytest python/engram_crewai/tests -q`.

### AB-FWK-7: Framework conformance suite (cross-cutting, thesis)
- goal: one script of 12 behaviours (write allowed, write denied, supersession, cross-person read denied, grant read allowed, expired item hidden, offboarded person hidden, explain by read id, and so on) run through each adapter; results land in `research/results/` as a per-framework table of what each seam can and cannot govern.
- files: `packages/bench/` or `research/scripts/fwk_conformance.py`, `research/configs/fwk-conformance.json`.
- effort: M
- depends on: AB-FWK-2 to 4.
- value: thesis, a per-seam coverage table, which states the limits honestly; rule 9 requires it be regenerated from a script.
- risks: scope creep; keep to the three shipped adapters.
- acceptance: `make test-repro` row for the table.

## Recommended order

1. **AB-FWK-1**, the kit and routes, because every adapter reuses it and the by-id read exposes a real gap.
2. **AB-FWK-3**, the AI SDK middleware, smallest effort and the quickest visible demo (Friday demo rule), pure TypeScript.
3. **AB-FWK-2**, LangGraph BaseStore, the highest reach and the cleanest interface match, but it needs a Python client, so it follows the first two. If one more TypeScript integration is wanted before it, AB-FWK-4 step one.

## Unverified

- LangChain JS legacy memory.
- AG2's current memory story beyond the new `ag2.knowledge` in-memory class; Semantic Kernel Python memory and whether `IMemoryStore` is obsolete.
- Letta client details beyond the file listing.
- Mastra star count includes `ee/` content.
- LlamaIndex `BaseMemoryBlock` signature (fetch timed out in verification).

## Verification (2026-11-21)

Checked:
- Every repo's licence, stars and push date by `gh api`: the table matches (Mastra is 29,714, not 29,713). Vercel AI SDK and Mastra show NOASSERTION on GitHub; npm reports Apache-2.0 for `ai` 7.0.179, `@ai-sdk/provider` 4.0.39 and `@mastra/core` 1.85.0, and Mastra's LICENSE.md carves out `ee/` directories (not absorbable). MIT for `@langchain/langgraph` 1.7.5, `@langchain/langgraph-checkpoint` 1.2.3 and `@openai/agents` 0.22.0; Apache-2.0 for `@google/adk` 2.5.0.
- No paper is cited, so there are no arXiv ids to check.
- Interfaces: LangGraph `GetOp`, `SearchOp`, `PutOp`, `ListNamespacesOp`, abstract `batch` and `supports_ttl` confirmed in source. CrewAI `StorageBackend` methods confirmed. OpenAI Agents JS `Session` is `getSessionId`, `getItems`, `addItems`, `popItem`, `clearSession` (resolves an earlier unknown). `MockLanguageModelV4` is exported from `packages/ai/test/index.ts` in vercel/ai (resolves another). LlamaIndex signature not re-verified.
- Repo claims: `packages/server/src/routes.ts` has exactly the listed routes, with no get-by-id, scope list or retire route. `sdk/ts` exists and `pnpm-workspace.yaml` includes `packages/*` and `sdk/ts`.

Corrected:
- AutoGen is archived, code is MIT via `LICENSE-CODE`, docs CC-BY-4.0; now "ideas only, archived".
- Generator licences verified MIT.
- Supersession: same-id writes are updates with a staleness check in core; resolved.
- The Python plans conflict with `pyproject.toml` ("uv workspace: research only") and the TypeScript-first preference; flagged below.

Refuted or weakened:
- "A retire route is a thin call into core" is wrong: no caller-facing retire exists. It is a new policy decision (who may retire, under which grant) and needs an ADR (ADR 0010: eviction retires, never deletes). The logic belongs in core, not the server.
- Overlap with ADR 0022: LangGraph, AI SDK and Mastra all have MCP clients, so governed tools already reach them through `engram mcp` (condition C7). The adapters' real added value is read filtering at the prompt and store seam; the thesis claim must be stated as that delta, not as new coverage.

Plan verdicts:
- AB-FWK-1 keep-with-fix: split the retire route into its own card with an ADR; by-id read and scope list go in core, with events.
- AB-FWK-2 keep-with-fix: ship TS `@engram/langgraph` (langgraphjs, MIT) first; the Python twin needs an AGENTS.md change for the uv workspace and is a later card; effort L at least.
- AB-FWK-3 keep.
- AB-FWK-4 keep-with-fix: step one only; step two dropped.
- AB-FWK-5 drop: bundles three unrelated adapters, session history is not memory, LlamaIndex unverified; an ADK-only card can be re-proposed.
- AB-FWK-6 drop: the vector-embedding signature does not fit a text-query read, weakens the thesis claim, and needs Python.
- AB-FWK-7 keep-with-fix: run only over shipped TypeScript adapters, as a `research/scripts` script with a MANIFEST row.

Litreview notes checked (repo-langgraph-basestore, repo-mastra-memory, repo-openai-agents-session, repo-google-adk-memory-service, repo-vercel-ai-sdk-middleware): frontmatter ids match file names, code URLs resolve to the repos above, no em dashes. Fixed the Mastra star count and licence wording, and the OpenAI JS method names.
