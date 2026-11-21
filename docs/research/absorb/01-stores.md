# 01-stores: memory stores and frameworks to absorb or connect (AB-STO)

## Executive summary

Engram has three adapters (files, Mem0 in process, Letta MemFS) and one fake. None sets `native_validity: true`, and the conformance suite (`packages/adapters/test/conformance/suite.ts`) has no case for `native_validity` or `native_graph`; it only checks that a `native_history` store has a `history` method. The capabilities ADR 0013 promised for Zep are therefore untested. Verified facts shape everything below. Graphiti (Apache-2.0, 33k stars) and cognee (Apache-2.0, 33k stars) are both Python with no embeddable TypeScript client. Graphiti's drivers today are Neo4j, FalkorDB and Neptune; the Kuzu embedded option is gone from the driver folder and Kuzu itself is archived. The one TypeScript-native temporal store found, LongMemory (formerly OpenMemory), is young. The best move is to build Engram's own bitemporal fact-graph adapter in TypeScript on `better-sqlite3`, which is already a dependency, following Graphiti's edge model (a port of the model, not of the code), after first extending the conformance suite with bitemporal and graph cases. Second, a format bridge for ChatGPT and Claude memory exports, entering the plane as candidate items with provenance `import`. Third, an adapter over LangGraph JS's `BaseStore` (MIT, verified API), the widest TypeScript integration surface. Correction from verification: the plane never consumes `native_validity` or `native_graph` (only `native_history` is read, in `plane/offboard.ts`), and ADR 0035 makes store independence a design property, so a bitemporal store has no consumer; AB-STO-2, 5 and 6 are dropped and AB-STO-1 is cut to what is testable. Mem0 v3 removed graph memory from the open-source SDK, so ADR 0013's description of Mem0 is stale.

## Landscape

Stars and dates are from `gh api` on 2026-11-21. npm data from `npm view`. "TS" means reachable from Node 24 without Docker.

| name | URL | licence | stars, last activity | language | what it gives us | TS reachability | absorb mode |
|---|---|---|---|---|---|---|---|
| Graphiti | github.com/getzep/graphiti | Apache-2.0 | 32,972; push 2026-11-20 | Python | bitemporal edges (`valid_at`, `invalid_at`, `created_at`, `expired_at`), episodes, `group_id` | No. Needs Neo4j, FalkorDB or Neptune; FalkorDBLite needs Python 3.12+. Reference FastAPI server and MCP server, both unauthenticated | port the data model; ideas |
| Zep (service) | github.com/getzep/zep | Apache-2.0 (repo) | 5,011; push 2026-11-17 | Python | hosted Graphiti | `@getzep/zep-cloud` 4.1.0 on npm, hosted only, npm licence field absent (unverified) | depend (optional, cloud) |
| cognee | github.com/topoteretes/cognee | Apache-2.0 | 33,442; push 2026-11-20 | Python | remember, recall, improve, forget; REST and MCP; local run | REST only. No npm package named `cognee` | depend over HTTP |
| LangGraph store (JS) | github.com/langchain-ai/langgraphjs | MIT | langgraphjs 3,422; push 2026-11-20 (the Python repo langgraph has 45,222); npm `@langchain/langgraph` 1.7.5 modified 2026-11-17 | TypeScript | `BaseStore` with `get`, `search`, `put`, `delete`, `listNamespaces`, namespace arrays, `InMemoryStore` (read from the 1.2.3 tarball) | Yes | depend |
| LangMem | github.com/langchain-ai/langmem | MIT | 1,780; push 2026-11-16 | Python | memory extraction and consolidation tools over the LangGraph store | No | ideas only |
| MemOS | github.com/MemTensor/MemOS | Apache-2.0 | 12,469; push 2026-11-20 | GitHub lists TypeScript as the main language; the core is Python | MemCube schema, MemGovernance (note 2507.03724 exists) | no npm client found under `@memtensor/memos` | ideas only |
| A-MEM | github.com/WujiangXu/A-mem | MIT | 1,020; push 2026-10-28 | Python | linked notes that evolve (note 2502.12110 exists) | No | ideas only |
| Mem0 | github.com/mem0ai/mem0 | Apache-2.0 | 69,295; push 2026-11-18 | Python and TS | already adapted; v3 drops graph and UPDATE/DELETE (note written) | Yes (`mem0ai` 3.3.1) | already depend |
| Letta | github.com/letta-ai/letta | Apache-2.0 | 25,506; push 2026-10-18 | Python server | already adapted through MemFS (ADR 0028); `@letta-ai/letta-client` 1.12.1 is Apache-2.0 but needs a server | Partly | already depend |
| LongMemory (was OpenMemory) | github.com/CaviraOSS/OpenMemory | Apache-2.0 | 4,585; push 2026-11-10 | TypeScript | SQLite engine with temporal history, recall modes, MCP | `longmemory` 1.3.3 (one version, 2026-08-31) depends on native `sqlite3` and a heavy tree (aws-sdk, ffmpeg, googleapis, notion). Its npm package has no `license` field and no LICENSE file in the tarball (checked by `npm pack`); only the GitHub repo says Apache-2.0 | ideas only until the tarball's licence is confirmed |
| Supermemory | github.com/supermemoryai/supermemory | MIT (repo); engine openness unverified | 31,680; push 2026-11-21 | TypeScript | `add`, `profile`, `search`, `containerTag`, connectors; local API on port 6767 | `supermemory` 5.1.2 Apache-2.0, `@supermemory/tools` 3.1.3 MIT | depend (adapter), later |
| Hindsight | github.com/vectorize-io/hindsight | MIT | 62,319; push 2026-11-20 | Python | "agent memory that learns", 2026 newcomer; only metadata read | `@vectorize-io/hindsight-client` 1.2.3 MIT | ideas only until read |
| Memobase | github.com/memodb-io/memobase | Apache-2.0 | 2,962; push 2026-01-11 | Python | user-profile memory | `@memobase/memobase` 0.0.18, stale (2025-07) | skip |
| MIRIX | github.com/Mirix-AI/MIRIX | Apache-2.0 | 3,508; push 2026-11-11 | Python | six memory types, screen capture assistant | none found | ideas only |
| MemoRAG | github.com/qhjqhj00/MemoRAG | Apache-2.0 | 2,277; last push 2025-09-11 | Python | memory-augmented RAG | none | skip (stale) |
| txtai | github.com/neuml/txtai | Apache-2.0 | 13,693; push 2026-11-21 | Python | semantic search and graph pipelines | none | skip (a retrieval library, not a memory store) |
| LadybugDB | github.com/LadybugDB/ladybug | MIT | 1,947; push 2026-11-21 | C++ | in-process Cypher graph, fork of Kuzu; `@ladybugdb/core` 0.22.3 | Yes | depend (option for AB-STO-2) |
| Kuzu | github.com/kuzudb/kuzu | MIT | 4,019; archived 2025-10-10 | C++ | the origin of LadybugDB | `kuzu` 0.11.3, no updates | do not depend |
| FalkorDB | github.com/FalkorDB/FalkorDB | NOASSERTION on GitHub (treat as not absorbable until read) | 10,500; push 2026-11-20 | Rust per GitHub | Graphiti's lightest server | `falkordb` client MIT, server not | ideas only |
| Claude and ChatGPT memory formats | support.claude.com, ChatGPT export | not applicable | not applicable | text and JSON | import and export bridge | pure TypeScript parsing | port (write our own parser) |

Not verified: Zep's Cloud licence, Supermemory's core licence, Hindsight's design, any ChatGPT field-level schema (the sources read do not give one), whether ChatGPT exports include memories.

## PR plans

### AB-STO-1 Conformance cases for validity, history and graph
**Verified: keep-with-fix.** Cut to cases that need no contract change: a fake `withValidity` mode and a capability-honesty case. Drop `neighbors?` and the as-of argument (no consumer; ADR 0035; the plane decides validity from its projection).
- **goal:** make `native_validity`, `native_history` and `native_graph` mean something. Add a conformance group that runs only when a capability is claimed: a rewrite with a changed `valid_to` keeps the old version readable through `history` oldest first; `search` and `list` with an as-of time return only items valid then (via an optional `asOf` argument, see risks); with `native_graph`, `neighbors(ref, depth)` returns linked items inside the scope filter only.
- **absorbs:** Zep paper's four timestamps (note 2501.13956), Graphiti `group_id` isolation.
- **files:** `packages/core/src/adapter.ts` (optional `neighbors?` and an optional as-of argument, by ADR amendment), `packages/adapters/test/conformance/suite.ts`, `meta.test.ts` (three new broken adapters), `packages/adapters/src/fake/index.ts` (a `withValidity` mode), `docs/decisions/0013-...` amendment, `fixtures/stores/conformance-corpus.json`.
- **effort:** M. **depends on:** none.
- **value:** product, a testable contract before any graph store lands. Thesis, closes the gap between ADR 0013's claim and the evidence, and supports H2 and ADR 0035.
- **risks:** changes the contract, so it is a core PR (rule 5 does not apply, no schema change). The as-of argument must not duplicate the plane's own validity filter; the store reports, the plane decides. Keep it optional.
- **acceptance:** `make test-one T=packages/adapters/test/conformance/meta.test.ts`, all new broken adapters fail their named cases.

### AB-STO-2 Temporal fact-graph adapter (the temporal-graph PR)
**Verified: drop.** A large new store nothing reads natively (the plane ranks in core and filters validity from its projection, ADR 0031 and 0035), its H4 claim is refuted by ADR 0035 (H4 is policy equivalence on GateMem only), and the request-identity check already covers files, Mem0 and Letta.
- **goal:** a TypeScript adapter, `createBitemporalAdapter`, that stores each item as a fact edge with world time (`valid_at`, `invalid_at`) and system time (`created_at`, `expired_at`), episodes that support it, and `group_id` equal to scope. A rewrite that changes content closes the old edge (`expired_at` set) and keeps it, so `history(ref)` is the edge chain. Declares `native_validity`, `native_history`, `native_search` (FTS5) and `native_graph`. No model call: entity links come from the item's `lineage` and an explicit `links` field on write, never from extraction.
- **absorbs:** Graphiti's edge and episode model, ported as a data model. Not vendored; Graphiti is Python.
- **files:** `packages/adapters/src/bitemporal/{index,schema,queries}.ts`, `packages/adapters/test/bitemporal/*.test.ts`, `packages/adapters/test/conformance/registry.ts` (one entry, `lexical: true`), `docs/decisions/00NN-bitemporal-adapter.md`, `docs/deps.md` (none if SQLite only; one row for `@ladybugdb/core` 0.22.3, MIT, if a Cypher graph is chosen, note it is pre-1.0 and a native build).
- **effort:** L. **depends on:** AB-STO-1.
- **value:** product, an offline governed store with real validity that needs no server. Thesis, the first adapter with native validity, which tests whether H2 and H4 hold when the store and plane both hold validity (the double-bookkeeping risk in note 2501.13956).
- **risks:** it is our own store, so passing our suite proves less than a third-party store would; AB-STO-3 and AB-STO-5 answer that. Two writers on one SQLite file need the lock pattern from the files adapter. Decide in the ADR that the plane's validity wins on a disagreement.
- **acceptance:** `make test-one T=packages/adapters/test/conformance/conformance.test.ts` with the new registry entry green, plus `make test-invariants`.

### AB-STO-3 Memory export bridge: import and export formats (the format-bridge PR)
**Verified: keep-with-fix.** Paths corrected below; actor source `import` needed.
- **goal:** `engram import --format <chatgpt|claude-text|jsonl> <path>` and `engram export --format <markdown|jsonl>`. Importers are pure functions from bytes to `ImportRow[]` (text, optional date, source line or conversation id). Each row becomes a Plane.write by an actor with `source: "import"` (ADR 0004 D4: the plane, not the caller, sets provenance kind from the actor's source, and `engram write` hard-codes `user`, so the import command needs its own actor source; check that Plane.write accepts a caller-chosen `candidate` status), a `hash` of the source line, status candidate, owner and scope from flags, so the gate and review decide. The Claude text parser reads the vendor's "date, then memory" lines. The ChatGPT parser reads `conversations-NNN.json` partitions, walks `mapping` from the current node to the root, and imports only user-authored memory-like items on request; it fails closed on an unknown shape and names the version it recognised.
- **absorbs:** the two vendors' formats (note repo-chatgpt-claude-memory-formats). Own parsers, no dependency.
- **files:** `packages/cli/src/import/{chatgpt,claude-text,jsonl}.ts` (pure parsers, no store I/O; not under `packages/adapters`, which holds store adapters), `packages/cli/src/{import,export}.ts` plus a registration in `packages/cli/src/commands.ts` (there is no `commands/` folder; calls the generated client, no policy), `fixtures/imports/` (synthetic only, rule 12), tests, `AGENTS.md` command list.
- **effort:** M. **depends on:** none.
- **value:** product, Twin onboarding from the memories people already have, and the export closes the data-portability story. Thesis, a measured poisoning surface: imported rows enter at trust `import`, which `TRUST_ORDER` ranks above tool, model, compaction and external (so the surface is real: vendor-generated memory text is trusted more than a tool echo), so MemPoison-style tests (note 2607.14651) get a realistic entry point.
- **risks:** ChatGPT's schema is only partly documented and has changed; export may or may not contain memories, so the parser needs a real export read locally (not committed). Personal data: fixtures synthetic. Licence none.
- **acceptance:** `make test-one T=packages/cli/test/import-chatgpt.test.ts`, and an e2e that imports a synthetic Claude paste and reads it back through `engram read` with every row explained.

### AB-STO-4 LangGraph `BaseStore` bridge in both directions
**Verified: keep-with-fix.** Direction (a) only. Direction (b), `EngramStore`, calls Plane and is an integration, not an adapter: its own card and package decision. `@langchain/langgraph-checkpoint` 1.2.3 (MIT) has one dependency, `@langchain/core` ^1.1.48; `BaseStore` has abstract `batch` and `get`, `search`, `put`, `delete`, `listNamespaces`, as claimed. It is already on the roadmap's deferred list ("Third and fourth adapters").
- **goal:** (a) `createLangGraphStoreAdapter(store: BaseStore)`: an Adapter over any LangGraph JS store (namespace array = scope split on `:`, key = item id, value = the item JSON). (b) `EngramStore extends BaseStore` so a LangGraph agent's memory goes through Plane.write and Plane.read, with the actor fixed at construction. Run the conformance suite over `InMemoryStore`.
- **absorbs:** `@langchain/langgraph-checkpoint` 1.2.3 (MIT), API read from its `.d.ts`.
- **files:** `packages/adapters/src/langgraph/index.ts`, `packages/adapters/test/langgraph/*.test.ts`, registry entry, `docs/deps.md` row (peer dependency, exact version).
- **effort:** M. **depends on:** none.
- **value:** product, the widest TypeScript framework hook and a Postgres or Redis-backed store for free through LangGraph's checkpointers. Thesis, a third structurally different store for ADR 0035. Direction (b) is a distribution channel.
- **risks:** the store's search is optional (embedding index config), so `native_search` is false unless the store has an index; pre-2.0 API may change; pulling `@langchain/core` weight (check the tarball's dependencies before adding).
- **acceptance:** conformance green on `InMemoryStore`, `make test-one T=packages/adapters/test/langgraph/store.test.ts`.

### AB-STO-5 Graphiti and Zep HTTP adapter (Python sidecar, optional)
**Verified: drop.** The plan itself predicts the fidelity rule fails; Graphiti's ingestion makes its own unseeded, uncached LLM calls (rules 6 and 7), and a cassette fake of a server proves nothing about the real one.
- **goal:** an adapter that speaks to Graphiti's reference FastAPI server (or Zep Cloud) over HTTP, to show the contract holds on a real third-party temporal graph. Run in CI only against a recorded-cassette fake server, never a live Neo4j.
- **absorbs:** Graphiti (Apache-2.0), depend over HTTP, nothing vendored.
- **files:** `packages/adapters/src/graphiti/index.ts`, a cassette fake under `fixtures/stores/graphiti/`, `research/` notebook script for a manual live run on FalkorDBLite.
- **effort:** L. **depends on:** AB-STO-1.
- **value:** thesis more than product: a live comparison of Engram's validity against a vendor's, for H2.
- **risks:** the server needs a graph database and has no auth (README), loopback only; its LLM-driven ingestion means items written may be rewritten into different facts, which breaks the "returns exactly the item written" fidelity rule. This is probably the finding: record it as a failure entry, with a documented lossy mode rejected.
- **acceptance:** the adapter's contract tests on the cassette server; a log entry stating what fidelity failed.

### AB-STO-6 In-process LongMemory adapter
**Verified: drop.** The npm tarball carries no licence field or LICENSE file, it is one version old with a heavy dependency tree and native sqlite3, and ids and windows are unproven.
- **goal:** adapter over `longmemory` 1.3.3 with SQLite, entity extraction off.
- **absorbs:** LongMemory (Apache-2.0).
- **files:** `packages/adapters/src/longmemory/index.ts`, tests, registry, deps row.
- **effort:** M. **depends on:** AB-STO-1 and a spike on caller-supplied ids and windows.
- **value:** a real third-party temporal store, no server. **risks:** rename in progress, native `sqlite3`, ids minted by the engine. **acceptance:** conformance green, or a failure log entry naming the field it cannot round-trip.

### AB-STO-7 ADR 0013 amendment for Mem0 v3 and a cognee HTTP adapter
**Verified: keep-with-fix.** Only the S amendment. The Mem0 adapter header and ADR 0013's RV3 amendments already describe the `_entities` collection, `infer: false` and the entity-link finding (`packages/adapters/test/mem0/mem0.test.ts:154` tests the file layout); what is stale is ADR 0013 line 9 (UPDATE/DELETE, graph variant). Drop the cognee adapter (REST server, no temporal model, no consumer).
- **goal:** amend ADR 0013 and `packages/adapters/src/mem0/index.ts`'s header (graph removed, ADD-only, entity collection) and test that the Mem0 adapter's `search` is unchanged by `{collection}_entities`. Then a cognee adapter over `remember`, `recall`, `forget` on its REST API.
- **effort:** S for the amendment, L for cognee. **depends on:** none, then a spike.
- **risks:** cognee has no stated temporal model and a server dependency; defer it until AB-STO-2 and AB-STO-4 land.
- **acceptance:** `make test-one T=packages/adapters/test/mem0/mem0.test.ts`.

## Recommended order

1. **AB-STO-1** (conformance for validity, history and graph). Without it every later store passes an empty bar, and it fixes the gap between ADR 0013 and the code.
2. **AB-STO-3** (import and export bridge). Independent, small, user-visible for Twin, and gives a realistic poisoning entry point for the thesis.
3. **AB-STO-2** (bitemporal fact-graph adapter). The signature feature. Do it after AB-STO-1 so the new capabilities are tested the day they exist. Follow with AB-STO-4 as the third-party check.

Literature notes written in `docs/readings/litreview/`: repo-graphiti.md, repo-cognee.md, repo-longmemory-openmemory.md, repo-supermemory.md, repo-chatgpt-claude-memory-formats.md, repo-mem0-v3-entity-linking.md.

## Verification (2026-11-21)

**Checked.** `gh api` for all 20 repositories; `npm view` for 14 packages; `npm pack` of `longmemory` 1.3.3 and `@langchain/langgraph-checkpoint` 1.2.3; the Graphiti driver folder; cognee's latest release; the six litreview notes this report cites (frontmatter, code URL, em dashes: none found); the four existing paper notes' titles (2501.13956 Zep, 2502.12110 A-MEM, 2507.03724 MemOS, 2607.14651 MemPoison all match). The repo files each plan names, plus `packages/core` for `native_*` use, `Actor.source` and the trust order.

**Corrected.**
- langgraphjs has 3,422 stars; 45,2xx was the Python repo (now 45,222). Mem0 69,295. FalkorDB is Rust on GitHub, not C.
- LongMemory: npm tarball has no licence field and no LICENSE file; only GitHub says Apache-2.0. Moved to ideas only. Also a heavy dependency tree.
- AB-STO-3: no `packages/cli/src/commands/` folder (it is `commands.ts`); parsers belong in `packages/cli`, not `packages/adapters`; provenance kind comes from the actor's `source` (ADR 0004 D4); `import` ranks above tool, model, compaction and external, not "external-adjacent".
- AB-STO-1, 2: `native_validity` and `native_graph` are not read anywhere in `packages/core`; ADR 0035 refutes the report's H4 value claim for a bitemporal store.
- AB-STO-7: the entity collection is already documented in the adapter header and ADR 0013.

**Refuted.** That a native-validity adapter tests H2 and H4 (ADR 0035); that the Mem0 entity-collection amendment is missing; that AB-STO-4(b) is an adapter.

**Not verified.** Zep Cloud's licence (npm field absent), Mem0 v3 migration guide wording, ChatGPT export contents, Supermemory core licence, Hindsight internals.

**Verdicts.** AB-STO-1 keep-with-fix; 2 drop; 3 keep-with-fix; 4 keep-with-fix; 5 drop; 6 drop; 7 keep-with-fix.
