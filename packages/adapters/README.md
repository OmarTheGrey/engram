# @engram/adapters

One adapter per memory store, each implementing the one `Adapter` contract that `packages/core` defines, and the conformance suite every adapter must pass. The plane owns an item's metadata (scope, provenance, validity, grants, status); the store owns its bytes. Back to the [root README](../../README.md).

## Rules

- **One contract for every store** (ADR [0013](../../docs/decisions/0013-adapter-contract-and-conformance.md)). The contract is `Adapter` in `packages/core/src/adapter.ts`, re-exported from `src/contract.ts`: `read`, `write`, `delete`, `list`, and optionally `search`, `history`, `diagnostics` and `derivedFields`, with capability flags (`native_validity`, `native_history`, `native_search`, `native_graph`).
- **No adapter is called directly outside its own tests** (AGENTS.md rule 2). Everything else reaches a store through `Plane.read` and `Plane.write`.
- **No store-specific branch in core.** A store that needs special handling gets it here, behind the contract.
- **No conformance case is skipped for one adapter.** The registry has no skip list; a failing case is fixed, not excluded.
- **No model, no network.** Mem0 runs in process with `infer: false`, so it never asks a model to extract or merge facts; the conformance suite installs a network guard.

## Main modules

| module | store |
|---|---|
| `src/files/` | `createFilesAdapter({ root, owner })`: a folder of Markdown in Claude Code's auto-memory layout, one memory per file with YAML frontmatter. Files Claude Code or a person wrote list as read-only items owned by `person:<owner>`; `MEMORY.md` is left to Claude Code (card A3, review card RV3) |
| `src/mem0/` | `createMem0Adapter({ embedder })`: open-source Mem0 (`mem0ai/oss`) in process, on its own local SQLite vector store; the whole item rides in Mem0's metadata, and telemetry is switched off before Mem0 loads (card A1) |
| `src/letta/` | `createLettaAdapter({ root })`: a Letta MemFS repository, Letta Code's git-backed memory, on local disk; items are `engram/<id>.md` and every write is one commit; needs git on the path (card A2, ADR [0028](../../docs/decisions/0028-letta-adapter-over-memfs.md)) |
| `src/fake/` | `createFakeAdapter()`: a complete in-memory adapter that passes the whole suite, used by every test above layer 1 that is not about a real store; `createHashingEmbedder()`, a deterministic embedder for Mem0 in tests and in the runner |
| `src/fs-safe.ts`, `src/lock.ts` | safe paths inside a store root, and the folder lock between writers |

## Use

Through the plane, never alone:

```ts
import { createFilesAdapter } from "@engram/adapters";
import { uuidv7 } from "@engram/cli";
import { createPlane, loadPreset, migrate, openSqlite } from "@engram/core";

const db = openSqlite("engram.db");
migrate(db);
const adapter = createFilesAdapter({ root: "/path/to/claude/memory", owner: "alice" });
const plane = createPlane({ db, adapter, policy: loadPreset("medium"), newId: uuidv7 });
```

Core takes `newId` as an injected UUIDv7 generator, since it reads no clock itself. From the command line, `engram read --root <folder> --owner <id>` reads a Claude Code memory folder through the plane, and `--store letta` takes a MemFS repository.

## Test

```sh
pnpm --filter adapters exec vitest run
make test-one T=packages/adapters/test/conformance/conformance.test.ts
```

- `test/conformance/`: the suite (`suite.ts`), run on every adapter in `registry.ts`: scope filtering, delete visibility, idempotent writes, search recall on a fixture corpus, and, since card A5, capability honesty (a store that claims a capability must show it) with a validity double in `validity.ts`.
- `test/plane/`: each store through the real Plane, including card A5's revocation grid (`revocation.test.ts`: a superseded item is never admitted and never outranks its replacement), replay of a recorded workload, adoption, grants and offboarding on the files store.
- `test/files/`, `test/mem0/`, `test/letta/`: what is specific to each store (Letta's commits and two writers racing on one repository).

## What is next

- Card E8.14 adds a read by id and a scope list in core and a conformance test for a framework adapter kit.
- More stores (Zep through Graphiti, LangGraph Store, Redis Agent Memory Server) are deferred past the degree ([`docs/roadmap.md`](../../docs/roadmap.md), appendix); each would be one registry entry and must pass the same suite.
- ADR 0035's request-identity check, which would compare every model request across the files, Mem0 and Letta stores, needs the files store in the runner first.
