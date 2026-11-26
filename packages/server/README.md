# @engram/server

The HTTP API over core (card E8.1, ADR [0027](../../docs/decisions/0027-http-contract-client-and-inspector.md)): one route table, a Hono app that serves it, the OpenAPI document generated from it, its authentication (card E8.12), the listener, the decision export, and the workspace opener every surface uses. `engram serve` runs it; the CLI and the MCP server call the same app in process. Back to the [root README](../../README.md).

## Rules

- **The route table is the contract.** Each route names its method, path, request and response schemas and a handler that calls the Plane or another core function, with no policy logic (AGENTS.md rule 1). `make api` writes `sdk/openapi.json` and the clients from it; never edit the generated files.
- **A decision is a response, not an error.** Allow, deny and ask are all 200 with their event. A request that fails its schema is 400, an explain by someone other than the reader is 403, and a route whose card has not landed (`/distill`) is 501 naming the card.
- **Every caller is known, or the server says it is not** (card E8.12, ADR [0042](../../docs/decisions/0042-verified-actors.md)). `engram serve` refuses to start without one of: `--keys <file>` (local API keys, stored hashed, made by `engram key`), `--issuer` with `--jwks` and `--subjects` (JWT access tokens of one issuer, each subject mapped to the actor the operator configured; no claim widens it, and a source the caller sends is ignored), or `--insecure-loopback` (no authentication, actors self-asserted, loopback only). Every event a served request appends records who was authenticated, in a side table beside the event. A host other than loopback needs credentials and an https `--resource` (a TLS proxy in front).
- **Loopback guards.** On loopback, before any route runs, a request must carry a loopback `Host` with the server's port, an `Origin` (when present) equal to the server's own, a JSON content type for a body, and a body under 1 MiB; no CORS header is ever sent.
- **The server's clock stamps every event.** A request names no time of its own (card RV5); only a read may ask for validity at another time.

## Main modules

| module | what it holds |
|---|---|
| `src/routes.ts` | `ROUTES` under `/api/v1`: `/items`, `/items/check`, `/read`, `/read/{itemId}` (one item by its id, card E8.14), `/scopes` (the scopes the actor can see, card E8.14), `/explain/{readId}`, `/promote`, `/supersede` (card L6), `/grants`, `/who-can-read/item` and `/who-can-read/scope` (card E2.13), `/export` (the rows of a bundle, card E9.8), `/retain`, `/events` (what `visibleEvents` lets the viewer see), `/policy`, `/lint`, `/simulate`, `/distill`, `/bypass`, `/viewer`, `/health` |
| `src/contract.ts` | the request and response schemas, built from core's |
| `src/app.ts` | `createApp(workspace, options)`: the guards, the error mapping, and the app as a fetch function |
| `src/openapi.ts` | `openApiDocument()`, the OpenAPI 3.1 document of the table |
| `src/auth.ts`, `src/keys.ts`, `src/attest.ts` | the bearer credential to the configured actor (JWT through jose, or a local API key), the key file, and the attestation recorded beside each served event (card E8.12) |
| `src/export.ts` | sends each decision appended after start as a content-free OpenTelemetry span to an OTLP/HTTP endpoint or a JSONL file, only when `--otlp` or `--export-jsonl` names one (card E8.13, ADR 0043) |
| `src/listen.ts` | `listen`: 127.0.0.1, `::1` or localhost, and another host only with credentials |
| `src/static.ts` | serves the built inspector (`packages/ui/dist`) at `/` with a strict Content-Security-Policy |
| `src/workspace.ts` | `openWorkspace`: the log (SQLite or Postgres, default `<home>/.engram/engram.db`), the policy (a preset or a YAML file) and the store, for the server, the CLI, the MCP server and the pi package; secrets in a database URL are redacted from every message |
| `scripts/api.ts` | run by `make api`: writes `sdk/openapi.json`, the client `sdk/ts` (`@engram/sdk`) and `packages/ui/src/api` |

## Use

```sh
make ui                     # once, so / serves the inspector
engram serve --root <store folder> --owner alice --insecure-loopback --as person:alice --member person:alice
engram key create --keys keys.json --as person:alice --source user --expires 2027-01-01T00:00:00Z   # or a key, printed once
engram serve --root <store folder> --owner alice --keys keys.json
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

`test/contract.test.ts` hits every route, `test/security.test.ts` each loopback and body rule, `test/errors.test.ts` the error mapping, `test/ui.test.ts` the static files and their paths, `test/rv5.test.ts` the server clock and the sweep before a read, `test/auth.test.ts`, `test/keys.test.ts` and `test/attestation.test.ts` the verified actors, `test/chain.test.ts` the chain under served writes, `test/export.test.ts` the decision export, `test/supersede.test.ts` the supersede route and `test/import-cap.test.ts` the import's trust cap.

## What is next

- The `/distill` route answers 501 until `Plane.distill` is wired (backlog).
- From the second absorb plan ([`docs/tasks/absorb-plan-2.md`](../../docs/tasks/absorb-plan-2.md)), none merged yet: the routes of the approval queue (cards E2.19 and E8.8) and a cross-surface parity and leak suite over this API, MCP and pi (card E8.16).
