# @engram/server

The HTTP API over core (card E8.1, ADR [0027](../../docs/decisions/0027-http-contract-client-and-inspector.md)): one route table, a Hono app that serves it, the OpenAPI document generated from it, the loopback listener, and the workspace opener every surface uses. `engram serve` runs it; the CLI and the MCP server call the same app in process. Back to the [root README](../../README.md).

## Rules

- **The route table is the contract.** Each route names its method, path, request and response schemas and a handler that calls the Plane or another core function, with no policy logic (AGENTS.md rule 1). `make api` writes `sdk/openapi.json` and the clients from it; never edit the generated files.
- **A decision is a response, not an error.** Allow, deny and ask are all 200 with their event. A request that fails its schema is 400, an explain by someone other than the reader is 403, and a route whose card has not landed (`/distill`) is 501 naming the card.
- **Loopback only, no authentication yet.** The listener refuses any host that is not loopback. Before any route runs, a request must carry a loopback `Host` with the server's port, an `Origin` (when present) equal to the server's own, a JSON content type for a body, and a body under 1 MiB; no CORS header is ever sent.
- **The server's clock stamps every event.** A request names no time of its own (card RV5); only a read may ask for validity at another time.

## Main modules

| module | what it holds |
|---|---|
| `src/routes.ts` | `ROUTES` under `/api/v1`: `/items`, `/items/check`, `/read`, `/explain/{readId}`, `/promote`, `/grants`, `/retain`, `/events` (what `visibleEvents` lets the viewer see), `/policy`, `/lint`, `/simulate`, `/distill`, `/bypass`, `/viewer`, `/health` |
| `src/contract.ts` | the request and response schemas, built from core's |
| `src/app.ts` | `createApp(workspace, options)`: the guards, the error mapping, and the app as a fetch function |
| `src/openapi.ts` | `openApiDocument()`, the OpenAPI 3.1 document of the table |
| `src/listen.ts` | `listen`: binds only to 127.0.0.1, `::1` or localhost |
| `src/static.ts` | serves the built inspector (`packages/ui/dist`) at `/` with a strict Content-Security-Policy |
| `src/workspace.ts` | `openWorkspace`: the log (SQLite or Postgres, default `<home>/.engram/engram.db`), the policy (a preset or a YAML file) and the store, for the server, the CLI, the MCP server and the pi package; secrets in a database URL are redacted from every message |
| `scripts/api.ts` | run by `make api`: writes `sdk/openapi.json`, the client `sdk/ts` (`@engram/sdk`) and `packages/ui/src/api` |

## Use

```sh
make ui                     # once, so / serves the inspector
engram serve --root <store folder> --owner alice --as person:alice --member person:alice
curl -s http://127.0.0.1:7313/api/v1/health      # {"status":"ok","schema_version":1}
```

From TypeScript, use the generated client rather than raw fetch:

```ts
import { createEngramClient } from "@engram/sdk";
```

## Test

```sh
pnpm --filter server exec vitest run
make api-check              # the generated contract and clients match what is committed
```

`test/contract.test.ts` hits every route, `test/security.test.ts` each loopback and body rule, `test/errors.test.ts` the error mapping, `test/ui.test.ts` the static files and their paths, and `test/rv5.test.ts` the server clock and the sweep before a read.

## What is next

- Card E8.12 (verified actors): bearer tokens from an external issuer and hashed, prefixed API keys, with an invariant that every event's actor was authenticated; loopback without a token only behind an explicit flag. An ADR comes first.
- Card E2.13 adds a who-can-read route, and card E8.14 a read by id and a scope list.
