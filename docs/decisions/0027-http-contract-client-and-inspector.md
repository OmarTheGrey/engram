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
