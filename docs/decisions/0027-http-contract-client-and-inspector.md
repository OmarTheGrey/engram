# ADR 0027: One HTTP contract for every surface: a route table, generated OpenAPI and client, loopback only until authentication

Status: accepted, pending lead review, 2026-10-29
Deciders: drafted by the orchestrating session on the lead's instruction (plan `docs/tasks/gate-b-plan.md`, decisions 4 to 6); pending review and acceptance by Omar (lead). Until then this records the design cards E8.1 to E8.6 follow.
Supersedes: nothing; it gives ADR 0001's "the HTTP server is thin, clients are generated from it" and ADR 0022's MCP surface their mechanism.

## Context

ADR 0001 makes the HTTP server a thin TypeScript layer over core with clients generated from it; cards E8.1 to E8.6 build the server, the client, the CLI and MCP server on that client, and the inspector. Until now the CLI calls core directly (the Gate A slice of E8.2). Four questions were open: how the OpenAPI document is produced without a second source of truth beside the Zod contracts; how the CLI can call a client without needing a running server; who the caller is, when there is no authentication yet; and what a browser page on the same machine can do to a server listening on localhost.

## Decision

1. **The route table is the single source.** The server is a Hono app. Each route is one entry naming its method, path, request and response Zod schemas (reusing core's contracts) and a handler that calls the Plane or another core function and holds no policy logic (rule 1). OpenAPI 3.1 is built from the table with Zod 4's `z.toJSONSchema`, not an OpenAPI plugin whose Zod range would have to track core's, and `make api` writes it to `sdk/openapi.json`.
2. **The client is generated.** `openapi-typescript` turns `sdk/openapi.json` into types and `openapi-fetch` is the run-time client; `make api` writes `sdk/ts/` and `packages/ui/src/api/`, never edited by hand, and `make api-check` covers them.
3. **In process by default.** The CLI and the MCP server call the client. With no server named, the client's fetch is bound to the app (`app.fetch`) over the local workspace, so no command needs a running server and every command is still one client call; `--server <url>` or `ENGRAM_SERVER_URL` sends the same calls over HTTP. `doctor` stays local: it checks the machine.
4. **Loopback only until authentication.** The server listens on 127.0.0.1 or ::1 and refuses any other host; it checks `Host` against loopback names (DNS rebinding), refuses an `Origin` other than its own, accepts only `application/json` bodies (a cross-site browser request with that type needs a preflight, which gets no CORS headers), and caps body size. `docker-compose.yml` gains no `server` or `ui` service until a card adds authentication.
5. **The actor is in the request and self-asserted**, as the CLI's `--as` is; the "CLI identity" follow-up covers both. The MCP server fixes its actor at launch with source `model`, and no tool parameter names an actor, a source or a provenance kind (ADR 0004, decision D4).
6. **A decision is a response, not an error.** Allow, deny and ask are 200 with the event; `InvalidCallError` is 400, `ExplainDeniedError` 403, `NotImplementedYet` 501 naming the card.
7. **The inspector reads through the plane.** It views as one actor; scope lanes come from `Plane.read` as that actor; the timeline shows `visibleEvents(actor, events)` (a pure core function: events in the viewer's member scopes and events the viewer made); the explain view uses `Plane.explain`, so only a read's own reader sees its explanations (decision D5). The read event's filtered counts are parsed by a core function beside the one that writes the reason.

Amendments made in PR 3 of the plan (cards E8.1, E8.3, E8.2, E8.4; branch gb-pr3-surfaces, 2026-10-29; pending the lead's review like the rest of this ADR):

- The table lives in packages/server/src/routes.ts, the schemas in contract.ts, the guards and error mapping in app.ts. Statuses the decision left open: `UnknownReadError` (new in core, thrown by explain for an id that names no read) is 404; a store call in a workspace with no store (`NoStoreError`) is 503; a request failing its schema or not JSON is 400; a refused Host or Origin is 403; a body that is not application/json is 415; a body over 1 MiB is 413; an unknown route is 404. Every error body is `{ error: { code, message, card? } }`; a 500 carries `internal error` only, and its error goes to `onError` (the server's stderr, or the CLI's in process).
- The JSON-body rule covers POST, PUT and PATCH; GET, HEAD and DELETE carry no body. The rules are one middleware, `loopbackGuard(port)`, which the MCP server's streamable HTTP endpoint also runs behind. The Host must be `127.0.0.1`, `localhost` or `[::1]` with the server's port, in the Host header and in the URL the app sees; `engram serve --host` accepts `127.0.0.1`, `::1` and `localhost`. The default port is 7313.
- `at` is optional in every request; the server fills it from its injected clock (the CLI's and the MCP server's `now`). Core still reads no clock.
- The write request's `item` is any JSON object, documented as a MemoryItem: the plane validates it and records an invalid one as a deny event (engram/write/schema), so the HTTP layer does not refuse it first. In the generated TypeScript types `JsonValue` is `unknown`, because openapi-typescript renders the recursive component as a type that names itself (TS2502).
- The read route runs what `engram read` ran before, so the CLI stays one call: when the workspace has a store, the store owner's retention sweep, then adoption of the store's own memories (ADR 0025, decision D8), then `Plane.read` as the caller; the response carries their reports as `sync` and the policy label as `policy`. Limit: `sync` is the owner's report and is not filtered by reader. On a loopback server with self-asserted actors that hides nothing a caller could not ask for, but a server with authentication must filter it.
- `visibleEvents` (packages/core/src/visible.ts): an event is visible to the actor who made it and to a member of its source or target scope. Read and bypass_blocked events carry no scope, nor does a write denied by the schema rule before a valid scope was known; those only their maker sees. A promotion refused for an item the promoter cannot access withholds its source scope and keeps its target, so members of the target see it. An event leaving a member scope (a promotion out of it, the retire that supersedes the source) is visible to that scope's members. Membership decides, not the read matrix. `POST /events` takes the viewer and an optional `after` seq.
- The client: `make api` runs packages/server/scripts/api.ts, which writes sdk/openapi.json, sdk/ts (package `@engram/sdk`, a workspace package: package.json, src/schema.ts by openapi-typescript, src/index.ts with `createEngramClient({ baseUrl, fetch })` over openapi-fetch) and the same two source files into packages/ui/src/api. openapi-typescript needs the TypeScript compiler API, which TypeScript 7 does not ship, so packages/server pins TypeScript 5.9.3 as its peer; type checking stays on 7.0.2.
- The workspace opener is packages/server/src/workspace.ts. It loads the policy and builds the store at once and opens the log on first use, so a route whose Plane method has not landed (lint, simulate, distill) never opens a log; the CLI opens it before its call, so a log problem prints as it always did. `--owner` alone opens no store (explain, retain and the hook take it as the actor); `--root` or `--store` does. `engram serve` without `--root` serves the log alone, and a write answers 503.
- In process, the client's base URL is `http://127.0.0.1:7313`, a label that never reaches a socket, so the guards hold there too. With `--server` or `ENGRAM_SERVER_URL`, the CLI refuses `--db`, `--root`, `--store`, `--policy` and `--import-valid-from`, which name the server's own workspace. `engram lint` sends scope `org` unless `--scope` names one; `engram simulate` sends an empty workload unless `--workload` names a file.
- The viewer of `GET /viewer` is `engram serve --as` with `--member` and `--level`, built as the CLI builds actors, without a source.

## Alternatives considered

- `@hono/zod-openapi` or Fastify with a Zod type provider: a second schema layer pinned to its own Zod range; the table plus `z.toJSONSchema` is a few dozen lines over the contracts core already exports.
- A CLI that requires a running server: every command would fail without `engram serve`, and the per-user SQLite log (decision D9) would gain a daemon.
- Lanes from the projection (`itemsAt`): faster and time-travelling, but a read that bypasses the read filter and leaves no event (rule 2); snapshots wait for E8.10.
- Binding any host with a warning: no authentication means any device on the network could write as anyone.

## Consequences

Unblocks E8.1 to E8.6 and the MCP handshake of layer 6. A shared Postgres log is not served to other machines until authentication exists. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/0001-pi-as-base.md`, `docs/decisions/0022-other-harnesses-through-mcp.md`
- `docs/tasks/gate-b-plan.md`, decisions 4 to 6
- MCP specification, transports: servers must validate `Origin` on streamable HTTP and should bind to localhost when run locally
