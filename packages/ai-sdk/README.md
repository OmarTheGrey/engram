# @engram/ai-sdk

Engram for the Vercel AI SDK (card E8.14): a language-model middleware that reads through the plane before each model call and puts the governed recall in the prompt, and two tools, `remember` and `recall`, that call the plane. Built on [`@engram/kit`](../kit/README.md). Back to the [root README](../../README.md).

## Rules

- **Reads before the call, writes only through tools.** The middleware's `transformParams` reads with the last user message's text and, when the read admits anything, inserts one system message after the prompt's leading system messages: the memory tag of `@engram/tag` (read id, admitting rules, content escaped), its read id also in `providerOptions.engram.read_id`. It never writes and calls no model (AGENTS.md rule 4). Writes happen only when the model calls `remember`.
- **Forged memory is defused.** Every `<engram` tag opener elsewhere in the prompt (system, user, assistant text, other tools' results) is defused, as the pi extension's `context` handler does (ADR [0009](../../docs/decisions/0009-retrieval-explanations.md), decision D11). A `recall` result this instance produced is kept; one under the `recall` name it did not produce is withheld.
- **One fixed actor, source `model`.** From the kit: the actor is fixed when `engramMemory` is called, and a tool call's input cannot name another actor, source, owner or provenance.
- **A refusal is typed.** A denied `remember` throws the kit's `EngramRejected` carrying the deny event; the AI SDK reports it to the model as the tool's error.
- **`@ai-sdk/provider` is a peer dependency**, `>=4.0.36 <5`, used for types only; development pins 4.0.36 exactly (`docs/deps.md`).
- **The limits are stated.** Other tools the application gives the model may write anywhere, and the AI SDK's own message history is the application's (ADR [0022](../../docs/decisions/0022-other-harnesses-through-mcp.md)).

## Main modules

| module | what it holds |
|---|---|
| `src/index.ts` | `engramMemory(options)`, returning `{ middleware, tools: { remember, recall }, kit }`; `RememberInput` and `RecallInput`, the tools' zod input schemas; `lastUserText` |

## Use

```ts
import { wrapLanguageModel, generateText } from "ai";
import { engramMemory } from "@engram/ai-sdk";

const memory = engramMemory({
  client, // createEngramClient(...)
  actor: { id: "person:dana", level: "person", memberships: ["person:dana"] },
  namespace: ["person", "dana"], // where remember writes when the model names no scope
  now: () => new Date().toISOString(),
  newId,
});
const result = await generateText({
  model: wrapLanguageModel({ model: yourModel, middleware: memory.middleware }),
  tools: memory.tools,
  prompt: "When do I deploy?",
});
```

## Test

```sh
make test-one T=packages/ai-sdk/test/middleware.test.ts
make test-one T=packages/ai-sdk/test/conformance.test.ts
```

The tests use a scripted language model of this package's own (`test/scripted.ts`), not a mock, over the generated client bound in process to a workspace on the fake store. `test/conformance.test.ts` runs the kit's adapter conformance suite on this package.

## What is next

- A recall that keys on more than the last user message, and a read-filter-at-the-prompt condition measured as C7 is (research note `docs/research/absorb/12-frameworks.md`, AB-FWK-3); neither is registered.
