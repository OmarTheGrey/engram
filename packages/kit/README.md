# @engram/kit

What every adapter for an agent framework repeats, in one place, so each adapter stays about a page (card E8.14). An adapter built on the kit reaches the plane only through the generated client (`@engram/sdk`), in process over a workspace's app or to a running `engram serve`. Back to the [root README](../../README.md).

## Rules

- **The actor is fixed at construction.** `createKit` copies and freezes the actor it is given and sets its source to `model` whatever it said (decision D4 of ADR [0004](../../docs/decisions/0004-provenance-and-source-trust.md)), as the MCP server fixes its launch actor. No method takes an actor, a source, an owner or a provenance kind, so nothing a model writes into a tool call changes who acts.
- **No policy logic** (AGENTS.md rule 1). The namespace mapper is syntax only; whether the actor may use a scope is the plane's decision.
- **No store** (rule 2). The kit and every adapter on it depend on no store adapter or store SDK and import no file system, SQLite or child process module; the conformance suite checks this statically and at run time.
- **No pi** and no model calls. Biome's restricted imports refuse pi packages here, as in core and the adapters.
- **The limits are stated.** As ADR [0022](../../docs/decisions/0022-other-harnesses-through-mcp.md) says of MCP, an adapter governs what passes through its seam, not state the framework keeps elsewhere (graph state, checkpointers, chat history), and not other tools that write elsewhere.

## Main modules

| module | what it holds |
|---|---|
| `src/index.ts` | `createKit(options)`: `remember` (one write through the gate, an `EngramRejected` carrying the deny event when the plane does not store it), `recall` (a governed read rendered in the shared memory tag of `@engram/tag`, with its event), `get` (`POST /read/{itemId}`) and `scopes` (`POST /scopes`); `scopeOf` and `namespaceOf` (`["person", "omar"]` to `person:omar`, `["org"]` to `org`, deeper namespaces refused); `EngramRejected`, `EngramCallError` |
| `test/conformance/suite.ts` | `@engram/kit/conformance`: `kitConformance(subject)`, the cases every adapter on the kit must pass (no path to a store but the plane, a denied write as `EngramRejected`, the actor unchanged by model output), and `staticViolations(root)` |

## Use

```ts
import { createKit, EngramRejected, scopeOf } from "@engram/kit";
import { createEngramClient } from "@engram/sdk";

const kit = createKit({
  client: createEngramClient({ baseUrl: "http://127.0.0.1:7313" }),
  actor: { id: "person:dana", level: "person", memberships: ["person:dana"] },
  now: () => new Date().toISOString(),
  newId, // a UUIDv7 generator
});
await kit.remember({ scope: scopeOf(["person", "dana"]), content: "prefers short summaries", ref: "my-framework:call/1" });
const { text } = await kit.recall("summaries"); // the memory tag a model may be shown
```

An adapter package runs the suite in its own tests:

```ts
import { kitConformance } from "@engram/kit/conformance";
for (const c of kitConformance(subject)) test(c.name, c.run);
```

## Test

```sh
make test-one T=packages/kit/test/kit.test.ts
make test-one T=packages/kit/test/conformance.test.ts
```

`test/conformance.test.ts` runs the suite on the reference adapter (`test/conformance/subjects.ts`) and on five broken ones, each of which must fail the case named for it: an adapter that trusts a model-named actor, one that reads the actor late, one that swallows a refusal, one that turns it into a plain error, and a package that imports a store (`test/fixtures/bypassing/`).

## What is next

- The LangGraph store (a `BaseStore` whose `batch` maps get, search, put and list-namespaces ops to the kit) and a Mastra processor, each its own card on the kit (research note `docs/research/absorb/12-frameworks.md`).
- A delete that maps to retirement needs a retire-by-id decision in core and an ADR first; it is out of this card's scope.
