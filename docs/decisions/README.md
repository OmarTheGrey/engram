# Decisions

One file per decision, `NNNN-<slug>.md`, format: context, decision, alternatives, consequences, sources. Status is one of proposed, accepted, superseded. A proposed ADR is a question with a recommended answer; accepting it is a `decision` log entry plus a status change in the same PR.

Every ADR, 0001 to 0030, is accepted by the lead, and the lead is its decider. ADRs 0001 and 0020 were decided by the lead directly. ADRs 0002 to 0030 were drafted during the project (0002 to 0023 in step-0 task S0.13 on 2026-10-22, 0024 to 0030 by the Gate A and Gate B plans on 2026-10-29, recorded in `docs/log/`) and accepted by the lead on 2026-11-02 with every amendment they carry (`docs/log/2026-11-02-adrs-accepted.md`); each file is authoritative. ADRs 0024 to 0030 have files only, no proposal below. The proposals below are kept as the record of what was decided from; they were distilled from the readings in `docs/readings/`, the gap analysis in the proposal, and checks run on 2026-10-17. Each proposal names the papers or facts that force it, the options, the recommended pick, and what it unblocks. They were accepted, amended or rejected in step 0 (see `docs/tasks/step-0.md`).

| # | Title | Status |
|---|---|---|
| 0001 | pi is the base building block of the control plane | accepted |
| 0002 | Memory item schema, versioning and generated contracts | accepted with amendments |
| 0003 | Event log as source of truth; store state as projection; SQLite via node:sqlite | accepted with amendments |
| 0004 | Provenance model and source trust | accepted with amendments |
| 0005 | Validity is bi-temporal; updates supersede, never overwrite | accepted with amendments |
| 0006 | Scope, owner and grants; policy as typed objects, not a policy language | accepted with amendments |
| 0007 | Write gate rules and source isolation | accepted |
| 0008 | Lints: deterministic first, model-based second, both as events | accepted |
| 0009 | Retrieval explanations carry score components, rank and policy decision | accepted with amendments |
| 0010 | Retention never deletes; eviction retires; long-horizon arm is mandatory | accepted |
| 0011 | One lifecycle for every class: candidate, active, retired; replay admission for procedures | accepted with amendments |
| 0012 | Induction method: Agent Workflow Memory over pi session trees, reimplemented in TypeScript | accepted |
| 0013 | Adapter contract with capability flags; conformance suite on a fake first | accepted with amendments |
| 0014 | No-bypass: store commands blocked in bash; MCP store tools wrapped | accepted with amendments |
| 0015 | Evaluation protocol: six benchmarks, seven conditions, vendored judges, label audit | accepted with amendments |
| 0016 | Statistics: paired bootstrap, Holm, three models from three providers, stopping rules | accepted with amendments |
| 0017 | Every model call is cached, metered and seeded; cassettes are the cache | accepted with amendments |
| 0018 | Duplicate and near-duplicate detection without embeddings by default | accepted |
| 0019 | Monorepo tooling | accepted with amendments |
| 0020 | Licence | accepted |
| 0021 | Twin: person and role scopes, consent grants, handover; offboarding deferred | accepted |
| 0022 | Other harnesses through MCP; interception limits stated | accepted with amendments |
| 0023 | Pre-registration lives in the repo, tagged, and is mirrored externally | accepted with amendments |
| 0024 | Db backends: one synchronous contract, SQLite per user by default, Postgres on a worker thread | accepted |
| 0025 | Retention semantics: expiry at read and by sweep, budgets enforced in the write queue, eviction order, retired content stays out | accepted |
| 0026 | Promotion: confirmations are independent corroboration, reviewers are user-sourced members, a promotion is a write under the target's rule | accepted |
| 0027 | One HTTP contract for every surface: a route table, generated OpenAPI and client, loopback only until authentication | accepted |
| 0028 | The Letta adapter works over MemFS, Letta's git-backed context repository, on local disk | accepted |
| 0029 | The poisoning arm runs on MEM-INV-Bench | accepted |
| 0030 | GateMem's principals are actors, its unrestricted relationships are memberships and read grants, read from the fields an agent may see | accepted |
| 0031 | What C1 and C4 are on GateMem and on MEM-INV-Bench | proposed |

---

## 0002 Memory item schema, versioning and generated contracts

**Forced by.** CoALA's three classes (episodic, semantic, procedural); Zep's bi-temporal edges; Eywa's evidence-before-belief; MemOS's MemCube, which we must compare to field by field; the roadmap rule that schema changes are one PR.

**Options.** (a) Zod 4 as the single source, JSON Schema via `z.toJSONSchema`, Python types generated from the JSON Schema. (b) JSON Schema hand-written, codegen both ways. (c) TypeBox.

**Recommended.** (a). Zod 4 has native JSON Schema export with `io`, metadata and registries, and the extension already lives in TypeScript. Fields: `id` (UUIDv7), `class`, `scope`, `owner`, `content`, `provenance`, `confidence`, `valid_from`, `valid_to`, `ttl`, `grants`, `version`, `lineage`, `status`, `store_ref`, `schema_version`. Every field has a one-line meaning in `docs/glossary.md`. `make api` fails CI on a dirty diff.

**Unblocks.** E0.2, every adapter, the Python analysis types.

## 0003 Event log as source of truth; store state as projection; SQLite via node:sqlite

**Forced by.** Eywa keeps SQLite authoritative and treats vector and graph as rebuildable projections; MemSecBench shows in-place repair damages benign memory, so removal must be an event, not a delete; the roadmap's replay-from-events test.

**Options.** Storage: (a) `node:sqlite` (unflagged since Node 22.13 and 23.4, release candidate as of 25.7, no native build, prepared statements, extension loading opt-in, transactions via `exec`); (b) `better-sqlite3` (mature, native build); (c) libsql. Identity: UUIDv7 or ULID.

**Recommended.** Append-only `events` table with dense `seq`, `item_id`, `actor`, `scope`, `op`, `decision`, `reason`, `policy_id`, `ts`; item state is a projection rebuilt by replay. `node:sqlite` behind a 40-line `Db` interface so Postgres or better-sqlite3 is a swap. UUIDv7 for items and events. Every projection has a `rebuild()` and a test that rebuild equals incremental.

**Unblocks.** E1.1, E1.2, replay tests, the policy simulator.

## 0004 Provenance model and source trust

**Forced by.** Eywa's evidence, signal, belief layers; MPBench's four write channels and nine structural vulnerabilities, with write-path provenance in its unevaluated defence list; MINJA's query-only injection; HaluMem's finding that errors enter at extraction and update.

**Options.** (a) A `provenance` object: `{kind, ref, hash, actor, session_entry_id, model?}` with `kind` in {user, document, tool, model, import, compaction}. (b) A free-text source string.

**Recommended.** (a). `kind: model` and `kind: compaction` are untrusted by default and cannot be promoted beyond person scope without a gate pass; pi `compaction` entries are the lowest trust because they are model-written summaries of mixed-trust content. The `hash` is of the evidence at write time, so the source-changed lint is a hash comparison. Trust levels live in policy, not in the item.

**Unblocks.** E1.2, E2.1, lints L1, seeded faults L2.

## 0005 Validity is bi-temporal; updates supersede, never overwrite

**Forced by.** Zep's event time versus ingestion time and edge invalidation; LongMemEval's knowledge-update category; PersonaMem's changing preferences; A-MEM's memory evolution rewriting notes with no lineage.

**Options.** (a) `valid_from`, `valid_to` on the item, ingestion time on the event, an update creates a new version with `lineage` pointing back and sets `valid_to` on the old one. (b) Single timestamp and in-place edits.

**Recommended.** (a). Reads default to the latest valid version at query time; a `valid_at` parameter returns history. The expired-validity lint is a comparison against the injected clock.

**Unblocks.** E1.2, L1, the LongMemEval update arm.

## 0006 Scope, owner and grants; policy as typed objects, not a policy language

**Forced by.** GateMem's principals writing into one pool and its leak-target annotation; the instruction hierarchy result that trained privilege still leaks; the requirement that every decision be explainable and simulable.

**Options.** (a) Typed TypeScript policy objects: a read matrix over scopes {person, role, team, org}, grant records (`from`, `to`, `scope`, `class`, `expires`), write rules per (scope, class, source kind), retention budgets, promotion gates; evaluated by one pure function returning a decision with a reason. (b) Cedar through `cedar-wasm`. (c) OPA or Casbin.

**Recommended.** (a) for the thesis. Cedar is a credible v2 for the company and is noted in the thesis as future work; it adds a language, a build step and a second explanation format now. The pure evaluator is the unit the invariants property tests target.

**Unblocks.** E2.1 to E2.5, the simulator, the invariants file.

## 0007 Write gate rules and source isolation

**Forced by.** MPBench (aggressive write policies are easier to poison; weak-signal attacks evade detectors); MemSecBench (adoption is the bottleneck, so blocking at write is cheaper than catching at read); Mem0's ADD, UPDATE, DELETE, NOOP as the interception point.

**Options.** (a) Deterministic rules only: source kind, scope, class, provenance presence, hash, size, and a per-scope budget. (b) Add a model-based classifier at write time.

**Recommended.** (a) at the gate; model-based checks are lints that run after the write and can retire. The gate is deterministic so the H1 condition "enforcement" has no model in it. Every MPBench attack class maps to a rule or a lint in `fixtures/faults/`; classes with no deterministic defence are listed in the thesis as such.

**Unblocks.** E2.2, L2, the MPBench arm.

## 0008 Lints: deterministic first, model-based second, both as events

**Forced by.** HaluMem (evaluate per operation, not end to end); the knowledge-conflicts taxonomy (inter-context conflicts need detection, and resolution is policy); Ground Truth First (write-stage errors track downstream failure).

**Options.** (a) Two tiers with the same interface: deterministic (expired validity, source changed, scope or class mismatch, missing provenance, orphan, duplicate) and model-based (contradiction, unsupported claim). (b) One model-based pass.

**Recommended.** (a). A lint finding is an event with `lint_id`, `severity`, `evidence`. Model-based lints take an injected `ModelCall`, are seeded and cached, and are reported separately in H3. Each lint ships a flag fixture and a near-miss fixture.

**Unblocks.** L1, L3, L4, X10.

## 0009 Retrieval explanations carry score components, rank and policy decision

**Forced by.** Generative Agents' scored retrieval (recency, importance, relevance); Lost in the Middle (rank is part of the outcome); MERIT (agents act on a retrieved value only about half the time, so what was returned and where must be inspectable).

**Recommended.** Every `Plane.read` returns items with an `explanation`: score components, rank, the policy rule that admitted the item, grants used, and the validity window applied. The same record is what the inspector shows and what `custom_message` carries into the model when policy allows.

**Unblocks.** E2.4, the inspector, the explanation evaluation.

## 0010 Retention never deletes; eviction retires; long-horizon arm is mandatory

**Forced by.** Ground Truth First's tenure crossover (budgeted memories win at three weeks and lose at nine because eviction removed old material); MemSecBench's finding that selective repair damages benign memory.

**Recommended.** Retention budgets per scope trigger `retire` events, never deletes; retired items stay replayable and can be reinstated by event. Hard deletion exists only for person-scope erasure and emits a deletion report. The evaluation includes a long-horizon arm so the cost of eviction appears.

**Unblocks.** E2.5, X9, Twin erasure.

## 0011 One lifecycle for every class; replay admission for procedures

**Forced by.** SKILL.nb (provisional, released, retired; evidence attached; gated execution); MSCE (probationary, active, archived; reliability score; boundary narrowing on rejection); Voyager (store only after a verified run); EvoMemBench (memory gains are conditional, so admission must be measured).

**Recommended.** `status` in {candidate, active, retired} for all classes. Procedures move candidate to active only after replay validation passes k of n runs on held-out tasks; active procedures carry a smoothed success rate; a drop below threshold or a changed environment hash retires them. A human can reject, which narrows the trigger rather than deleting the item.

**Unblocks.** D1 to D4, H5.

## 0012 Induction method: Agent Workflow Memory over pi session trees, reimplemented in TypeScript

**Forced by.** AWM (ICML 2025) is the simplest published method with strong results and a Python reference implementation; ReasoningBank shows failures carry signal; EvoMemBench catalogues alternatives. The roadmap's rule: govern a published method, do not invent one.

**Options.** (a) Reimplement AWM's induction prompt and workflow format in TypeScript over pi session JSONL, using abandoned branches as negative examples. (b) Call the Python reference over subprocess. (c) ReasoningBank.

**Recommended.** (a), with the induction prompt vendored verbatim and cited. Abandoned branches and `branch_summary` entries are the failure signal. Strategies (ReasoningBank-style) are out of v1.

**Unblocks.** D2.

## 0013 Adapter contract with capability flags; conformance suite on a fake first

**Forced by.** The stores differ in what they do natively: Mem0 (extract and update with ADD, UPDATE, DELETE, NOOP; history endpoint; graph variant), Letta (memory blocks plus archival; TypeScript client), Zep (native bi-temporal), files (nothing). The plane must respect a native feature rather than duplicate it.

**Recommended.** `Adapter` with `read`, `write`, `delete`, `list`, `search?`, `history?` and `capabilities: {native_validity, native_history, native_search, native_graph}`. `store_ref` is opaque. A complete in-memory fake passes the full conformance suite; real stores run the same suite in CI service containers. Mem0 through its TypeScript OSS package, Letta through `@letta-ai/letta-client`, files through the filesystem.

**Unblocks.** A1 to A4.

## 0014 No-bypass: store commands blocked in bash; MCP store tools wrapped

**Forced by.** Invariant 2 is meaningless if an agent can write to the store from a shell; MPBench's write channels include tool outputs.

**Recommended.** The extension's `user_bash` and `tool_call` handlers block a configured list of store commands and endpoints (`mem0`, `letta`, direct file writes under adapter roots) and route them through the Engram tools. MCP tools that reach a store are wrapped so their calls pass the gate. A blocked bypass is an event.

**Unblocks.** PX1, Gate A check.

## 0015 Evaluation protocol: six benchmarks, seven conditions, vendored judges, label audit

**Forced by.** GateMem, MPBench, LongMemEval, MERIT, MemoryAgentBench and tau2-bench cover governance, poisoning, recall, action, competencies and tool use; Ground Truth First's six percent LoCoMo error rate; MERIT's and Kapoor's cost accounting; EvoMemBench's warning that long-context baselines stay competitive.

**Recommended.** Benchmark tasks run through the pi runner with the condition selecting the extension and policy; upstream judges are vendored at pinned commits and called over subprocess with JSON on stdin and stdout; a 50-item label audit per benchmark is done before any run and reported; a long-context no-memory baseline is a condition. Code availability for GateMem and MPBench is unverified as of this writing and is step 0's first check.

**Unblocks.** B1 to B9, X1.

## 0016 Statistics: paired bootstrap, Holm, three models from three providers, stopping rules

**Forced by.** Kapoor (joint accuracy and cost, holdouts); MERIT (seed gaps up to 0.45 on the same task, so seeds are not optional); Nosek (fix the analysis first).

**Recommended.** Three hosted models from three providers through pi-ai, three seeds each; paired bootstrap intervals on condition differences per benchmark; Holm across the five hypotheses; a stopping rule per hypothesis written before the first run; analysis code tested on synthetic data with planted effects before it sees real data.

**Unblocks.** R1, X2 onward.

## 0017 Every model call is cached, metered and seeded; cassettes are the cache

**Forced by.** MERIT's full metering; the roadmap's compute ceiling; the testing convention's rule that no test reads the network.

**Recommended.** Cache key `(benchmark item, condition, preset, store, model, seed, prompt hash)`; value includes usage and cost from pi-ai; `ENGRAM_OFFLINE=1` refuses a miss. The cache directory is the cassette fixture set. Usage is written to a cost ledger in the event log so the frontier chart is derived, not computed by hand.

**Unblocks.** X1, every experiment.

## 0018 Duplicate and near-duplicate detection without embeddings by default

**Forced by.** The duplicate lint must be deterministic to count in H3's deterministic tier; pi-ai does not appear to expose an embeddings API (unverified); stores differ in native search.

**Recommended.** Exact duplicate by normalised content hash; near-duplicate by MinHash over shingles with a fixed threshold; embedding-based similarity only through a store's native search when `native_search` is set, reported as a model-based lint. No embedding provider is a dependency of core.

**Unblocks.** L1.

## 0019 Monorepo tooling

**Recommended.** pnpm workspaces; TypeScript 7 (amended 2026-10-17 by the lead: 5.x was outdated, 7.0 is the native compiler); Node 24 (type stripping for scripts, `node:sqlite`); tsdown for published packages; biome for lint and format; vitest and fast-check; `@modelcontextprotocol/sdk` for the MCP server; uv for `research/` with ruff, mypy, pytest, hypothesis; one Makefile over both. CI on GitHub Actions with a service container for each real store. Exact pins for every pi package and benchmark.

**Unblocks.** E0.1.

## 0020 Licence

**Options.** Apache-2.0 (patent grant, common for infrastructure, company-friendly); MIT (simplest); AGPL-3.0 (protects a hosted product, deters some adopters). Thesis text and figures CC BY 4.0 regardless.

**Recommended.** Apache-2.0 for the code. This is the owner's call; the ADR records it.

## 0021 Twin: person and role scopes, consent grants, handover; offboarding deferred

**Forced by.** GateMem's shared-pool leaks; the 1,000 People paper (interview-grounded twins are measurable, and consent and deletion are design); PersonaMem (preferences supersede).

**Recommended.** Every person has a `person` scope (never readable by others without a grant) and a `role` scope (handed to a successor by event). Grants are explicit, scoped by class, and expire. Twin bootstrapping from an interview is a prompt template in the pi package. Offboarding with a deletion report stays on the kill list.

**Unblocks.** E9.1 to E9.5.

## 0022 Other harnesses through MCP; interception limits stated

**Forced by.** ADR 0001; Claude Code hooks can block tool calls but cannot transform context; Codex has MCP only.

**Recommended.** The MCP server exposes the four governed tools and `simulate`. Claude Code additionally gets a hook configuration that blocks store commands. The thesis reports "governed tools without read filtering" as its own condition so the H4 claim is honest about what the MCP path cannot do.

**Unblocks.** E8.4, E8.5.

## 0023 Pre-registration lives in the repo, tagged, and is mirrored externally

**Forced by.** Nosek; the roadmap's Gate A requirement that v0 is committed and dated.

**Recommended.** `docs/research/preregistration.md` versioned and dated; each version is a git tag `prereg-vN`; the version that precedes the first real run is also deposited externally (OSF or Zenodo, whichever the supervisor prefers) so the date is independently attested. Changes after that are amendments with reasons, never edits.

**Unblocks.** R1, Gate A.
