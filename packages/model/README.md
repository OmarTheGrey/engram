# @engram/model

The model-call layer the benchmarks and the runner share (ADR [0033](../../docs/decisions/0033-shared-model-package.md)): the cached, seeded call every model call in a run goes through (ADR [0017](../../docs/decisions/0017-cached-metered-seeded-model-calls.md)), the scripted models every test uses, and the cassette proxy that gives an outside harness the same guarantees (card B10, ADR [0036](../../docs/decisions/0036-cassettes-beyond-the-repository.md)). Back to the [root README](../../README.md).

## Rules

- **It imports core and pi-ai only**, never `@engram/bench` or `@engram/runner`, so both can import it without a cycle. It reaches pi-ai for the faux provider behind the scripted pi model.
- **One cache key everywhere:** (benchmark item, condition, preset, store, model, seed, prompt hash), computed by `cacheKey`. The prompt hash covers the whole request, tool definitions and tool calls included.
- **Offline, a miss is an error.** Under `ENGRAM_OFFLINE=1` (set in CI) a call that misses the cache throws `OfflineMissError` instead of reaching a model.
- **Scripted models fail loudly.** A request the table has no answer for throws, naming its hash, model and seed.
- **The proxy never records in replay mode**, and refuses recording under `ENGRAM_OFFLINE=1`.

## Main modules

| module | what it holds |
|---|---|
| `src/cached.ts` | `cached(inner, options)`: wraps a call with the cache and its usage ledger, so concurrent identical calls reach the model once; `cacheKey`, `memoryCache`, `fileCache` (a cassette folder), `OfflineMissError`, `TransientCallError` |
| `src/scripted.ts` | `scriptedModelCall(table)`: a core `ModelCall` that answers from a table keyed on the request's hash; `scriptedPiModel` for pi SDK sessions; `scriptedChatCall` for the proxy's tests, with tool calls |
| `src/proxy.ts` | `startProxy(options)`: a loopback server speaking OpenAI's chat-completions API (`POST /v1/chat/completions`), each request served through the cache; the experiment cell comes from the start-up configuration and `x-engram-*` headers; embeddings and streaming answer 501 until a harness needs them; `checkHarnessEndpoint` refuses a harness pointed anywhere else |
| `src/recording.ts` | where recording is allowed: only under `.engram/` or outside the repository, never into committed fixtures except by `make fixtures` |

## Use

The proxy is how MERIT and tau2-bench, which reach their models through LiteLLM, obey rules 6 and 7 without being ported: the harness is started with its API base pointed at the proxy, and every call it makes is answered from the cassettes.

```sh
make bench BENCH=merit     # MERIT through the proxy, replayed offline
make bench BENCH=tau2      # tau2-bench through the proxy, replayed offline
```

In a test, a scripted call stands in for a model:

```ts
import { scriptedModelCall } from "@engram/model";

const call = scriptedModelCall({ "<request hash>": '{"verdict":"pass"}' });
```

## Test

```sh
pnpm --filter model exec vitest run
```

`test/proxy.test.ts` is card B10's acceptance: a miss is an error, and a second run makes zero new calls. `test/scripted.test.ts` and `test/scripted-call.test.ts` cover the scripted models.

## What is next

- Card L7: a local NLI scorer for the contradiction lint, `src/nli.ts`, injected into core as `ModelCall` is, with its weights vendored by hash and every score cached by model hash, runtime version and pair hash.
- Embeddings and streaming through the proxy, when a harness card needs them.
