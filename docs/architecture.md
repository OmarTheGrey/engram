# Engram architecture

> **Status: living document, subject to change.** This describes the architecture as decided on 2026-10-22. Any part of it will change if the team decides to, or finds a better approach. Changes land as ADRs under `docs/decisions/` with a log entry, and this file is updated in the same PR as the code that changes the thing it describes. ADRs 0002 to 0023 (except 0020, the licence) were drafted as accepted in step 0 and are pending the lead's review; where this file assumes one of them, it says so.

## One paragraph

Engram is a control plane between agents and the stores that hold their long-term memory. Every write and every read crosses the plane. The plane records the operation as an append-only event, applies the policy for the scope, attaches provenance and validity, filters what comes back, and can explain any recall. The store does not change: the plane owns the metadata, the store owns the bytes. The plane never calls a model. It is built on pi (ADR 0001): the pi extension is where writes and reads are intercepted, the pi session tree is the episodic record, and pi-ai is how any model is reached by the parts that need one.

## Layers

```
Agents and harnesses        pi (reference harness, extension loaded) · Claude Code and Codex via MCP · any SDK via the client
        |
Profiles                    Knowledge (Govern) · Twin · Procedures (Distill): a policy file plus a few screens each
        |
Engram plane                schema · event log · policy engine · lints · explain · simulator · distiller
        |                   surfaces: pi extension, MCP server, CLI, HTTP server, inspector UI, generated clients
Adapters                    files (markdown folders, Claude Code memory) · Mem0 · Letta; each behind one contract
        |
Stores                      unchanged
```

Two rules make four people and their coding agents able to build this without colliding: logic lives in `packages/core` and `packages/adapters`, and every surface only calls them; the schema is the contract and everything else is generated from it.

## Memory model

Assumes ADR 0002 (Zod schema, generated contracts), 0004 (provenance), 0005 (bi-temporal validity), 0011 (lifecycle).

```
MemoryItem
  id              UUIDv7
  class           episodic | semantic | procedural
  scope           person:<id> | role:<id> | team:<id> | org
  owner           principal id
  content         text or structured payload; procedural items carry a skill body and a tool allowlist
  provenance      { kind: user | document | tool | model | import | compaction, ref, hash, actor, session_entry_id? }
  confidence      0..1
  valid_from, valid_to          event time; null valid_to means open
  ttl             duration | null
  grants          [ { to: principal or agent pattern, class?, mode: read | read_write, expires? } ]
  version, lineage              every update is a new version pointing at the one it supersedes
  status          candidate | active | retired
  store_ref       { adapter, key }      opaque; where the bytes live
  schema_version

MemoryEvent  (append only, source of truth; item state is a projection)
  seq, ts, op (write | read | update | evict | promote | retire | lint | gate | bypass_blocked)
  item_id, actor, scope_from, scope_to, decision (allow | deny | ask), reason, policy_id
  usage? (tokens, cost) for any model call made on the plane's behalf

Policy  (typed objects, one pure evaluator; ADR 0006)
  write:      allowed source kinds per scope, confidence floor, classes forbidden per scope, requires_review per scope
  read:       scope matrix (which principals and agents may read which scopes), grant honouring, calling context
  retention:  ttl per class and scope, budget per scope, eviction (recency | utility | manual) that retires, never deletes
  promotion:  episodic to semantic after k confirmations or review; procedural candidate to active after replay validation
  lints:      enabled set and thresholds

Lints  (each finding is an event)
  deterministic: expired validity, source changed (hash), scope or class mismatch, missing provenance, orphaned source, duplicate (hash, MinHash)
  model-based:   contradiction between active semantic items, unsupported claim relative to its provenance
  procedural:    replay validation drift below threshold, environment hash changed
```

Two invariants, enforced by an always-on property test:

1. No read returns an item whose scope matrix or grants exclude the requester.
2. No write lands in a scope that forbids its class or source.

Both are checked at the boundary, both are the basis of H1, and every denial is an event with a reason.

## Write path

1. An agent calls `memory_write` (a pi tool, an MCP tool, or the client).
2. Inside pi, the extension's `tool_call` handler decides with `Plane.checkWrite` (the same decision, nothing committed): a deny is committed there as its event and blocks the call; an allowed write is committed by `Plane.write` in the tool's `execute`, so a call that a later handler blocks or that is aborted never reaches the store (decision D12 of the PR #7 review fix pass). The decision committed in `execute` is the one that counts: writes run one at a time, so a write the check allowed can still be denied there, and it is returned to the model as that denial. Elsewhere the server checks and writes in one step.
3. `Plane.write(actor, item_in, at)`: refuse an invalid actor or time before touching the store or the log (no event could carry it); validate the item against the schema; set provenance from the actor's harness-set `source` (kind and actor overwritten; without a source the caller's provenance stands and the reason says so); evaluate the write gate: the actor is a member of the item's scope (and of its current scope on a rewrite), a rewrite keeps the owner and does not lower the version, every grant names a class, an expiry and a principal or a prefixed pattern (none on model or compaction content), then the rule for the target scope level; on allow, call the adapter, record `store_ref`, append the event; on deny, append the event with the reason and return it. A store failure after an allow appends a deny event (`engram/write/store-failure`) and rethrows, so the store is never written without an event. Writes over one log handle run one at a time, so each is decided against the projection the previous one left. A denial about an item id held in a scope the writer cannot read does not name that item's scope, owner or version. Model-written and compaction-derived content is untrusted by default and cannot leave person scope without a gate pass (ADR 0004, 0007; decisions D4 and D6 of the PR #5 review fix pass).
4. Inside pi, the decision is mirrored as a `custom` entry (`customType: "engram.event"`) in the session.

Adoption is the write path for what a store already holds, such as a Claude Code memory folder written before the plane governed it (`adoptStoreItems`, packages/core/src/plane/adopt.ts; ADR 0007, decision D8). The plane lists the store's items in one scope and runs each through step 3 as the store's owner with source `import`, recording an allowed item at the store_ref it already has without writing it; every adoption event's reason starts "adopted from store <name>: ". An item the projection already holds as the store has it is skipped, and so is a denied item whose hash, recorded in its deny event, is unchanged. When the store no longer lists a projected item of that scope, or the gate denies the store's new version of it, the plane retires the projected item with one retire event (`engram/adopt/retract`), so a read never returns content the store no longer has; when the store reports the entry as unreadable (`Adapter.diagnostics`, such as a file whose frontmatter no longer parses), the retire reason says so and names the store's diagnostic. Fields the store derives from its own bookkeeping rather than stores (`Adapter.derivedFields`, such as the files adapter's modification-time `valid_from`) are left out of the comparison and the deny hash, so touching a file adds no event. `engram read` adopts the folder before every read.

## Read path

1. An agent calls `memory_read`, or pi assembles context before a model call.
2. `Plane.read(actor, query)`: candidates are only the items the reader can reach (a readable scope, or a grant whose `to` matches it); the adapter is searched only in the readable scopes the reader is a member of, and an item reached only through a grant is matched by the plane over the projection, so hidden items never compete with it for a store's capped hit list; scope and grant filter; validity window at query time (or `valid_at`); ranking with named score components, relevance ranked among admitted items only; an `explanation` per returned item (components, rank, admitting rule, grants used, validity window); append a read event. What the reader gets (items, explanations, scores, `filtered`) reveals nothing about items out of its reach; the read event, the audit record kept from the model, counts them too (ADR 0009, decision D5).
3. Inside pi, the extension records every memory result it produces (by tool call id: the actor, and for a read the read id and admitted items) and every recall it injects; `before_agent_start` can inject governed recall with its explanation as a `custom_message` when policy allows. The `context` handler applies no second filter: it shows the model only those recorded results, for the current actor, rebuilt from the record and tagged with the read id and each item's admitting rule (content escaped), and withholds every other memory_* result (another extension's tool or rewrite, another actor's or an earlier process's read) with one bypass event each, and defuses every `<engram` tag opener in every other message, so no other text can pass as governed memory. The session stores a placeholder as the content of each read and recall, the items only in their details, which pi never sends to a model, so compaction, branch summaries and pi's bug-report summary are made without memory. A handler of another extension that runs after Engram's can still change what is sent (ADR 0009, decision D11).

## No-bypass

Store commands are blocked in pi's `user_bash` and `tool_call` handlers wherever a store name stands in the command, and pi's file tools are blocked on paths inside a store root; both are routed through the Engram tools. Core decides both (packages/core/src/no-bypass.ts), and the Claude Code PreToolUse hook (`engram hook claude-code`) runs the same checks. A name or path a variable, alias or script supplies at run time is out of reach of any text check (decision D10). MCP tools that reach a store are wrapped so their calls pass the gate. A blocked bypass is an event (ADR 0014). Outside pi, this guarantee is weaker and the thesis says so (ADR 0022).

## Lifecycle

`candidate` to `active` to `retired` for every class. Procedural items are admitted only after replay validation passes k of n runs on held-out tasks (outcome checked, not completion); active skills carry a smoothed success rate; a drop below threshold, a changed environment hash, or a human rejection (which narrows the trigger) retires them. Retention budgets trigger `retire` events; hard deletion exists only for person-scope erasure and emits a deletion report. Retired items stay replayable and can be reinstated by event (ADR 0010, 0011).

Retention (card E2.4, ADR 0025): the pure `evaluateRetention` decides; an item past its ttl (the tighter of its own and its rule's) is excluded at read at once (`engram/read/ttl`, counted in `filtered`) and retired by the next sweep with op `retire`; a budget overage is evicted with op `evict` in the rule's order (recency by last change, utility by how often reads returned the item, manual asks with one `evict` event of decision `ask`). `Plane.retain(actor, scope, at)` sweeps one scope as a member of it, in the write queue; it retires by ttl only in the actor's own person scope or for a user-sourced actor, so one skewed clock cannot retire shared memory. The write path runs the budget check of the written scope and class in the landing write's own queue slot, never evicting the item just written and counting no item past its ttl, and returns its events in `WriteResult.retention`. Reasons name no item to an actor who cannot read the scope. Utility counts explanation rows, which the log does not hold, so a utility eviction replays as an event but cannot be re-decided from the log. The pi extension sweeps after an allowed write and at `before_agent_start` for the session's scopes, and `engram read` before adoption; nothing runs on a timer. A `model`, `compaction` or `tool` write restating content an allowed retire or evict event retired in its scope is denied (`engram/write/retired-content`, by the normalised content hash of packages/core/src/content-hash.ts); a user, document or import write may re-admit it. The store is never written or deleted by retention.

## Model access

`packages/core` has no import from pi-ai. Model-based lints and the distiller receive a `ModelCall` injected at the boundary; inside pi it is built on the session's model runtime, in the runner it is scripted or cassette-backed. Every call is seeded, cached on (benchmark item, condition, preset, store, model, seed, prompt hash), and metered into a usage ledger (UsageRecord per call) that the runner writes to `usage.json` beside its results; it is not in the event log yet (ADR 0017).

## Interfaces

```
Adapter
  read(ref) · write(item) · delete(ref) · list(scope) · search?(query, scopeFilter) · history?(ref)
  diagnostics?() · derivedFields?(item)     entries the last list could not read; fields the store derived itself
  capabilities: { native_validity, native_history, native_search, native_graph }

Plane
  write(actor, itemIn, at) -> WriteResult    policy and provenance, then the adapter, then the event carrying store_ref; at is the injected time
  read(actor, query) -> ReadResult           search in readable member scopes, match granted items, filter, explanation, event
  promote(actor, itemId, toScope, at, {review?}) -> GateResult   evidence from the log, judged as a write into toScope; new version or in place (ADR 0026)
  retain(actor, scope, at) -> RetentionReport  expiry then budgets over one scope, as a member, in the write queue (ADR 0025)
  lint(scope) -> Finding[]
  simulate(workload, policy) -> SimReport    replays a recorded workload or a pi session under a policy; zero model calls
  distill(sessions, method) -> MemoryItem[]  candidate procedural items
  explain(actor, readId) -> Explanation[]    to the actor who made the read only

visibleEvents(actor, events, view) -> MemoryEvent[]   pure, in core: events in the actor's member scopes and events it
                                                made; an event naming no scope (a read, a bypass) only its maker sees;
                                                an event's item only if the read filter would return it now

Surfaces
  pi extension   tools memory_write, memory_read, memory_explain, memory_simulate; commands /engram explain | lint | simulate | policy
  MCP server     the same tools for Claude Code and Codex (packages/mcp): engram mcp --as --member over stdio
                 or streamable HTTP on loopback, every call as that actor with source model; the pi extension's
                 tool definitions and memory tag; engram hook claude-code, a PreToolUse hook that blocks bypasses
  HTTP           packages/server, a Hono app over one route table (ADR 0027): /api/v1/items, /items/check, /read,
                 /explain/{readId}, /promote, /retain, /events (visibleEvents), /policy, /lint, /simulate,
                 /distill (501 naming L1, E8.9, D2), /bypass, /viewer, /health; a decision is 200 with its event;
                 loopback Host and Origin only, JSON bodies only, no CORS, 1 MiB bodies; OpenAPI generated
                 into sdk/openapi.json, the client into sdk/ts and packages/ui/src/api
  CLI            engram write | read | promote | explain | retain | lint | simulate, each one client call, in
                 process over app.fetch or to --server; engram serve | mcp | hook claude-code | doctor
  UI             inspector at / of engram serve, as one viewer: lanes by scope (a Plane.read), timeline (visibleEvents), explain with the read's counts (v0, E8.5 and E8.6); later diff, findings, review queue, live session via pi RPC
```

## Repository layout

See `AGENTS.md` for the authoritative map. In short: `packages/core` (plane, no I/O, no pi imports), `packages/adapters`, `packages/pi-extension`, `packages/pi-package`, `packages/mcp`, `packages/cli`, `packages/server`, `packages/ui`, `packages/bench`, `packages/runner`, `research/` (Python: configs, scripts, results, analysis, thesis), `sdk/` (generated), `docs/`.

## Open items this file does not settle

- Calling context as a policy input: absent in v1, justified in ADR 0006's amendments (the harness enters through `actor.source` and memberships); a per-tool context is v2 with a policy language.
- Whether the distiller stores strategies as well as procedures (ADR 0012 says procedures only in v1).
- Authentication for the HTTP and MCP surfaces: none in v0; both listen on loopback only and the actor is self-asserted (ADR 0027).
- Cedar or another policy language: noted as v2 in ADR 0006.
