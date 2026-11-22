# @engram/tag

The memory tag and the `memory_write` and `memory_read` definitions every surface shows a model, as pure functions with no pi import (card E8.14's review fix pass, finding E8.14-4; ADR [0033](../../docs/decisions/0033-shared-model-package.md)). The pi extension, the MCP server, the framework kit and `@engram/ai-sdk` all render governed memory through it. Back to the [root README](../../README.md).

## Rules

- **One shape everywhere.** A governed read is shown as `<engram:memory read_id policy_id filtered>` with one `<engram:item>` per item, content escaped (ADR [0015](../../docs/decisions/0015-evaluation-protocol.md), amended in PR 6); an ungoverned read (conditions C2 to C4) uses the same shape without the read id and rules.
- **Openers are defused.** `neutraliseTags` turns `<` and its lookalikes before `engram` into `&lt;`, so no other text can pass as governed memory; it is the pi path's, unchanged from before card E8.14, so no registered condition's prompt moves. `neutraliseEntities` and `neutraliseAcross`, for the framework adapters only, also defuse an opener written as a numeric character reference (`&#60;`, `&#x3c;`) or split across adjacent texts (review findings E8.14-7 and E8.14-13).
- **No pi, no policy.** Its only workspace dependency is `@engram/core`, for types; `typebox` defines the tool parameters. Biome's restricted imports refuse pi packages here.

## Main modules

| module | what it holds |
|---|---|
| `src/tag.ts` | `recallDetails`, `tagRecall`, `tagUngovernedRead`, `neutraliseTags`, `neutraliseEntities`, `neutraliseAcross`, `WITHHELD`, and the `RecallDetails` and `RecalledItem` types |
| `src/tools.ts` | `MEMORY_WRITE`, `MEMORY_READ` and `writeResultText` |

The pi extension's `context` handler, which rebuilds recorded results and withholds every other memory result, stays in `packages/pi-extension/src/tag.ts`, which re-exports these names.

## Test

```sh
make test-one T=packages/tag/test/tag.test.ts
```

## What is next

Nothing planned.
