# @engram/core

The plane itself: the schema, the event log, the policy engine, the lints, explain, replay, the simulator, offboarding and the no-bypass checks. Every decision Engram makes is made here. Everything else in the repository is a surface or a harness that calls this package. Back to the [root README](../../README.md); the design is [`docs/architecture.md`](../../docs/architecture.md).

## Rules

- **Only core holds policy logic** (AGENTS.md rule 1). A surface that needs to know whether something is allowed asks core; it never decides itself.
- **No store I/O.** Core talks to a store only through the `Adapter` interface it defines (`src/adapter.ts`); the adapters live in `packages/adapters`. Core's own I/O is its event log (`src/db/`).
- **No model calls** (rule 4). Model-based lints and the distiller receive a `ModelCall` (`src/model.ts`) injected at construction. Core imports nothing from pi-ai, pi-coding-agent or pi-durable.
- **No clock, no randomness.** Every time is passed in (`at`), and ids come from an injected `newId`. The one exception, the Postgres transport's connection and query timeouts, decides nothing.
- **Every decision is one event** with a `reason` and a `policy_id` (rule 3). A decision without an event is a bug.
- **Schema changes are their own PR** (rule 5): edit `src/schema.ts`, bump `schema_version`, add a migration, run `make api`.

## Main modules

| module | what it holds |
|---|---|
| `src/schema.ts` | the Zod contract: `MemoryItem`, `MemoryEvent`, `Policy`, `Explanation`, `LintFinding`, `Grant`. JSON Schema, OpenAPI, the TypeScript client and the Python types are generated from it |
| `src/plane.ts` | `createPlane(deps)` and the `Plane` interface: `write`, `checkWrite`, `read`, `promote`, `changeGrants`, `retain`, `lint`, `simulate`, `recordBypass`, `explain`, `events`, and `distill` (not implemented, card D2) |
| `src/plane/` | one file per operation: `write.ts`, `read.ts`, `retrieve.ts` (the core retrieval pipeline), `promote.ts`, `grants.ts`, `retention.ts`, `lint.ts`, `simulate.ts`, `adopt.ts` (taking in what a store already holds), `offboard.ts` (handover, erasure and the deletion report; a core function, no surface calls it yet), `commit.ts` (the commit protocol under the log's lock), `bypass.ts`, `before-read.ts` |
| `src/policy/` | the pure evaluator: `evaluate.ts` (`evaluateWrite`, `evaluateRead`, the grant rule), `load.ts` (YAML loading, `loadPreset`, `PRESETS`), `retention.ts`, `promotion.ts`, `grants.ts` |
| `policies/` | the three presets, `strict.yaml`, `medium.yaml`, `permissive.yaml` |
| `src/events.ts`, `src/items.ts`, `src/replay.ts` | appending events, the projection of the item set, and `itemsAt(db, seq)`, which rebuilds the item set at any event from the log alone |
| `src/db/` | the `Db` interface, `openSqlite` (node:sqlite) and `openPostgres`, and the migrations |
| `src/lint/` | `det.ts`, the deterministic lints (expired validity, changed source, scope or class mismatch, missing provenance, orphaned source, duplicate), and `model.ts`, the model-based ones (contradiction, unsupported claim) |
| `src/no-bypass.ts` | `shellBypass` and `toolBypass`: does a shell command or a file tool reach a store or the log directly? Used by the pi extension and the Claude Code hook |
| `src/visible.ts` | `visibleEvents`: which events a viewer may see |
| `src/oracle.ts`, `src/dogfood.ts` | the invariants' oracles, written independently of the evaluator, and the twin dogfood's violation report built on them |
| `src/distill/` | the episode format and the secret scrub of the session recorder (card D1) |
| `src/content-hash.ts`, `src/time.ts`, `src/actor.ts`, `src/model.ts` | the normalised content hash, full-precision timestamps, the `Actor` type and the `ModelCall` type |

Scripts: `scripts/export-schema.ts` (run by `make api`), `scripts/faults.ts` (the fault catalogue in `fixtures/faults/`, and `make fault-workspace`), `scripts/dogfood-report.ts` (`make dogfood-report`).

## Use

A plane over the in-memory fake store, under the medium preset. A write in one's own person scope is allowed; a read by another person returns nothing.

```ts
import { createFakeAdapter } from "@engram/adapters";
import { type Actor, createPlane, loadPreset, type MemoryItem, migrate, openSqlite } from "@engram/core";

const db = openSqlite(":memory:");
migrate(db);
let n = 0;
const newId = () => `01920000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
const plane = createPlane({ db, adapter: createFakeAdapter(), policy: loadPreset("medium"), newId });

const at = "2026-11-21T12:00:00Z";
const alice: Actor = { id: "person:alice", level: "person", memberships: ["person:alice"], source: "user" };
const item: MemoryItem = {
  id: newId(), class: "semantic", scope: "person:alice", owner: "person:alice",
  content: "The deploy key rotates every 90 days.",
  provenance: { kind: "user", ref: "cli", hash: `sha256:${"0".repeat(64)}`, actor: "person:alice" },
  confidence: 0.9, valid_from: at, valid_to: null, ttl: null, grants: [],
  version: 1, lineage: [], status: "active", store_ref: null, schema_version: 1,
};

const { event } = await plane.write(alice, item, at);
// event.decision "allow", event.policy_id "preset.medium/write/person"

const read = await plane.read(alice, { text: "deploy key", at });
// read.explanations[0].score.components: { relevance: 1, confidence: 0.9, recency: 1 }

const bob: Actor = { id: "person:bob", level: "person", memberships: ["person:bob"], source: "user" };
(await plane.read(bob, { text: "deploy key", at })).items.length; // 0
```

## Test

```sh
pnpm --filter core exec vitest run          # the whole package
make test-invariants                         # the seven invariants and the stateful model, against the real Plane
make test-one T=packages/core/test/unit/plane/write.test.ts
```

The tests are in layers (`docs/conventions/testing.md`): `test/unit/` (pure functions and the Plane on the fake store), `test/property/` (the invariants, with fast-check; `invariants.test.ts` is owned by the lead and never skipped), `test/replay/` (the log rebuilds the same state), `test/db/` (the `Db` contract on SQLite and on an embedded Postgres started by `test/db/global-setup.ts`; `ENGRAM_PG=skip` skips it, `ENGRAM_PG_URL=<url>` uses a server you name), and `test/counterexamples/` (card E2.7's characterisation tests of the trust gaps). `test/helpers/failpoint.ts` fails a step by name for the crash-window tests.

## What is next

Cards of the absorb plan ([`docs/tasks/absorb-plan.md`](../../docs/tasks/absorb-plan.md)) that land here:

- **Landing:** E2.9, the secret and personal-data guard at the write gate, and E2.10, the deterministic injection screen, both behind the `content_guards` block E2.8 added (off by default and in every registered preset); X15, the plane's latency against bare SQLite, in `packages/core/bench/`.
- **Next:** L5 (near-duplicate lint), L6 (a supersession helper that proposes end dates), E2.11 (trust floors, opt-in, with an eighth invariant), E1.6 (a tamper-evident event log that keeps erasure possible), L7 (a local NLI tier for the contradiction lint, through an injected scorer), D2 (`Plane.distill` with Agent Workflow Memory), E2.12 (the policy exported to Cedar, with a differential test), E2.13 (`whoCanRead`), E8.13 (decisions as OpenTelemetry spans).
