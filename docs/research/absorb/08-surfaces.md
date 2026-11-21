# 08-surfaces: integrations, protocols, auth, inspector, developer experience

## Executive summary

The surfaces area has moved since ADR 0022 was written. Three facts change the plan. (1) MCP spec revision 2026-07-28 and TypeScript SDK v2 (stable since 2026-07-27, now 2.4.0, Apache-2.0) remove protocol sessions and the initialize handshake, which undercuts the stateful HTTP design from RV-SRF-6, and Engram pins SDK 1.32.1 (v1.x only targets 2025-11-25). (2) The spec makes OAuth 2.1 with RFC 9728 protected resource metadata the HTTP authorization model, and Engram's server is already Hono, which `@modelcontextprotocol/hono` and better-auth both fit. A resource-server design closes the "identity is self-asserted" limit without building an authorization server. (3) Codex, Cursor and Gemini CLI all ship deny-capable hooks, so ADR 0022's "Codex has no hook" is out of date, and a second and third hook adapter are cheap. The UI has no component library (React 19 and openapi-fetch only), so a provenance graph is a clean, small addition. Everything below is Apache-compatible; the one licence trap is elkjs (EPL-2.0 or GPL). I verified licence, stars and dates with `gh api` and `npm view`. I did not verify A2A or AG-UI wire details, only repository metadata.

## Landscape

Stars and dates are from `gh api` on 2026-11-21 unless marked.

| Name | URL | Licence | Stars, last push | Lang | Gives us | Mode |
|---|---|---|---|---|---|---|
| MCP spec 2026-07-28 | github.com/modelcontextprotocol/modelcontextprotocol | MIT moving to Apache-2.0 (docs CC-BY-4.0) | 9.7k, 2026-11-21 | TS | Stateless MCP, OAuth 2.1 resource-server rules, CIMD, cacheable lists | ideas, conform to it |
| MCP TS SDK v2 (`@modelcontextprotocol/server`, `client`, `hono`) | github.com/modelcontextprotocol/typescript-sdk | Apache-2.0 on npm (repo mixed, transition) | 13.8k, 2026-11-19; server 2.4.0, hono 2.0.2 | TS | 2026-07-28 support, Hono adapter, DNS-rebinding guard | depend |
| MCP conformance suite | github.com/modelcontextprotocol/conformance | NOASSERTION on GitHub; LICENSE is the same MIT to Apache-2.0 transition text as the spec; npm `@modelcontextprotocol/conformance` 0.1.16 is MIT (a 0.2.0-alpha line also exists) | 149, 2026-11-16 | TS | Spec conformance as an acceptance test; the SDK runs it against 2025-11-25 and 2026-07-28 | depend (dev), pre-1.0 |
| better-auth + `@better-auth/oauth-provider` | github.com/better-auth/better-auth | MIT | 30.8k, 2026-11-20; 1.7.27 | TS | OAuth 2.1 server: PKCE S256, RFC 8707, CIMD, DCR, JWT tokens | depend, optional |
| jose | github.com/panva/jose | MIT | 7.9k, 2026-11-18; 6.2.18 | TS | JWT and JWKS verification for an external issuer | depend |
| node-oidc-provider | github.com/panva/node-oidc-provider | MIT | 3.9k, 2026-11-20 | JS | Certified OIDC provider alternative | ideas only |
| Lucia, next-auth | lucia-auth/lucia, nextauthjs/next-auth | MIT, ISC | 10.4k (2026-08-08), 28.4k (2026-07-22) | TS | Nothing; both quiet since mid-2026 | skip |
| Official memory MCP server | github.com/modelcontextprotocol/servers/src/memory | NOASSERTION on GitHub; same MIT to Apache-2.0 transition LICENSE (both compatible) | 92.1k repo, 2026-11-19 | TS | Nine knowledge-graph tools (create_entities, search_nodes, read_graph ...); the tool surface to be a drop-in for | ideas, compat shim |
| mem0 (OpenMemory lived here) and its `integrations/` | github.com/mem0ai/mem0 | Apache-2.0 | 69.3k, 2026-11-18 | Py | Plugins for Claude Code, Codex, Cursor, opencode, pi; a template for ours | ideas |
| Graphiti MCP server | github.com/getzep/graphiti/mcp_server | Apache-2.0 | 33.0k, 2026-11-20 | Py | Episode and fact tools; Docker-oriented | ideas only |
| A2A | github.com/a2aproject/A2A; `@a2a-js/sdk` 1.3.0 | Apache-2.0 | 26.6k, 2026-11-20; spec v1.0.1 (2026-05-28) | TS SDK | Agent Card, tasks; agent-to-agent, not memory | ideas, later |
| AG-UI | github.com/ag-ui-protocol/ag-ui; `@ag-ui/core` 1.0.5 | MIT | 20.9k, 2026-11-20 | TS | Event stream agent to UI; could stream governed decisions to a front end | ideas, later |
| xyflow (`@xyflow/react` 13.0.2) + `@dagrejs/dagre` 3.1.3 | github.com/xyflow/xyflow | MIT | 39.1k, 2026-11-19 | TS | Provenance graph | depend |
| TanStack Table 9.3.1, Virtual 3.14.26 | github.com/TanStack/table | MIT | 28.6k, 2026-11-18 | TS | Event table, sorting, virtual rows | depend |
| jsdiff `diff` 9.0.0 | github.com/kpdecker/jsdiff | BSD-3-Clause | 9.2k, 2026-11-18 | JS | Version diff for superseded items | depend |
| shadcn/ui | github.com/shadcn-ui/ui | MIT | 128.7k, 2026-11-20 | TS | Copy-in components on Radix | port |
| openapi-python-client | github.com/openapi-generators/openapi-python-client | MIT | 2.0k, 2026-11-18 | Py | Python SDK from sdk/openapi.json | depend (dev) |
| Starlight 0.43.1 / Fumadocs 16.19.5 / Docusaurus | withastro/starlight, fuma-nama/fumadocs, facebook/docusaurus | MIT | 9.6k, 13.7k, 66.8k | TS | Docs site | depend (dev) |
| Cursor, Codex, Gemini CLI hooks | cursor.com/docs/hooks, learn.chatgpt.com/docs/hooks, geminicli.com/docs/hooks | docs; Codex Apache-2.0 (136k stars), Gemini CLI Apache-2.0 (109k) | | | Deny hooks and context injection | port |
| elkjs | github.com/kieler/elkjs | EPL-2.0 or GPL-3.0 | 2.9k | JS | Graph layout | **not absorbable** |

Not covered: Windsurf, Cline and Continue (both Apache-2.0, 71.8k and 36.5k stars) were checked for licence only, not their extension points. The VS Code extension API was not researched beyond `microsoft/vscode-extension-samples` (MIT).

## PR plans

### AB-SUR-1: Bearer-token identity for the HTTP API and MCP HTTP
- **title:** Verified actors: OAuth 2.1 resource server on `engram serve` and `engram mcp --http`
- **goal:** Replace self-asserted actors with a verified token subject mapped to an actor id and its memberships. Publish RFC 9728 protected resource metadata, return a `WWW-Authenticate` challenge, check audience (RFC 8707). Loopback with no token stays available under an explicit `--insecure-loopback`. Stdio keeps `--as`.
- **absorbs:** MCP spec 2026-07-28 authorization; jose for verification; optionally better-auth `oauth-provider` as an embedded issuer (spike first).
- **files:** new `packages/server/src/auth.ts`, `packages/server/src/app.ts` (middleware), `packages/mcp/src/transports.ts`, `packages/cli/src/serve.ts`, `packages/cli/src/mcp.ts`, a membership mapping table via core's existing membership concept (policy stays in core), new ADR, `docs/deps.md`, `docs/architecture.md` (remove the "self-asserted" limit), tests with a fake issuer (a local JWKS).
- **effort:** L
- **depends on:** AB-SUR-2 (so the work lands once on v2), ADR for the actor mapping.
- **value:** Product: real multi-user Twin and Govern, offboarding that means something. Thesis: removes the stated identity limit; the invariants can add "every event's actor was authenticated".
- **risks:** Pin rule: better-auth and `@better-auth/oauth-provider` 1.7.26 and 1.7.27 are 1 to 3 days old (1.8.0-beta.11 also exists), so the embedded issuer cannot be pinned before about 2026-12-04; start with jose only (6.2.18 was published 2026-11-18, also under two weeks, so pin 6.2.17 or earlier). Mapping issuer and subject to `person:<id>` is a policy choice (ADR). better-auth docs disagree on mcp() versus oauthProvider(), a v1.8 beta exists, and SQLite storage support is unconfirmed. Token claims must never widen grants. MIT, no licence risk.
- **acceptance:** `make test-one T=packages/server/test/auth.test.ts` (unsigned, wrong-audience, expired and wrong-issuer tokens are 401; a valid token acts as its mapped actor and cannot name another).

### AB-SUR-2: Move the MCP server to SDK v2 and spec 2026-07-28
- **title:** MCP SDK v2 migration, stateless HTTP
- **goal:** Move from `@modelcontextprotocol/sdk` 1.32.1 to `@modelcontextprotocol/server` and `hono`. Drop per-session servers (RV-SRF-6); give memory_simulate an explicit workload handle or read the log. Pass the conformance suite.
- **absorbs:** typescript-sdk v2, `@modelcontextprotocol/hono`, conformance suite.
- **files:** `packages/mcp/src/server.ts`, `transports.ts`, `package.json`, `docs/deps.md`, amend ADR 0022, `fixtures/harness/*`.
- **effort:** M
- **depends on:** none.
- **value:** Product: current-spec clients keep working. Thesis: none directly.
- **risks:** v2 uses Zod, ADR 0022 chose the low-level Server to keep one TypeBox definition. Raw JSON Schema tools: v2 documents `fromJsonSchema(...)` (docs/servers/tools.md in the SDK repo), so ADR 0022's single TypeBox definition can likely stay; confirm in a spike. v2 serves both eras (legacy `initialize` for 2024-10-07 to 2025-11-25, modern from 2026-07-28; `@modelcontextprotocol/server-legacy` exists), and Claude Code and Codex may still connect as legacy clients, so keep a legacy path that holds the workload for memory_simulate rather than dropping sessions outright. Conformance suite licence resolved: MIT on npm, pre-1.0. 
- **acceptance:** `make test-e2e` handshake plus the conformance suite against `engram mcp --http`.

### AB-SUR-3: Provenance graph, timeline and diff in the inspector
- **title:** Inspector: provenance graph, event table, version diff
- **goal:** An item page with a graph of lineage (supersession) and decision events (xyflow with dagre), a virtualised sortable event table, and a text diff between versions. Every node comes from data the server already returns for that viewer.
- **absorbs:** `@xyflow/react`, `@dagrejs/dagre`, `@tanstack/react-table`, `@tanstack/react-virtual`, `diff`.
- **files:** `packages/ui/src/App.tsx` (split into views), new `packages/ui/src/provenance.tsx`, `view.ts`, `data.ts`, `packages/ui/package.json`, `docs/deps.md`, a Playwright case in `make test-e2e`, fixture in `fixtures/workspaces/inspector`.
- **effort:** M
- **depends on:** none (a graph endpoint only if `lineage` is not enough; then a `/items/{id}/lineage` route and `make api`).
- **value:** Product: the "every recall can be explained" claim becomes visible; a demo asset. Thesis: a figure for Part II.
- **risks:** Graph must respect the read filter (hidden items must not appear as ghost nodes). Bundle size. The schema field is `lineage` (ids of the versions an item supersedes, nearest first), not `supersedes`; other edges may need events. MIT and BSD, no licence risk. Avoid elkjs (EPL-2.0 OR GPL-3.0-or-later, verified on npm). Pin rule: `@xyflow/react` 13.0.0 to 13.0.2 were published 2026-11-16 and 2026-11-17, under two weeks old on 2026-11-21, so pin the 12.x line (12.12.1) or wait until 2026-12-01; dagre 3.1.3, react-table 9.3.1 and diff 9.0.0 are old enough.
- **acceptance:** `make test-e2e` inspector case asserting the graph for a fixture item with three versions and that a viewer without the grant sees none of the hidden nodes.

### AB-SUR-4: Python SDK
- **title:** `engram-client` Python package generated from sdk/openapi.json
- **goal:** A typed Python client in `sdk/py`, generated by openapi-python-client in `make api`, with a check in `make api-check`. Product only: no `research/` script calls the plane over HTTP today (the only urllib uses in research/scripts fetch benchmark data), so the thesis gets nothing from it.
- **absorbs:** openapi-python-client (MIT, dev tool). Existing `research/engram_types` stays for schemas.
- **files:** `Makefile`, `sdk/py/` (generated), `pyproject.toml`, `docs/deps.md`, AGENTS.md (sdk list), a small pytest under `research/`.
- **effort:** S to M (`sdk/py` must join `GENERATED` in the Makefile so `make api-check` covers it)
- **depends on:** none.
- **value:** Product: Python agent frameworks (the mem0 and Graphiti audiences) can use Engram. Thesis: none (refuted claim removed).
- **risks:** Generated client style is opinionated (attrs, httpx). Needs the OpenAPI to use stable operation ids. AGENTS.md says do not edit generated dirs, so the generator config must live in the repo.
- **acceptance:** `make api-check` plus `uv run pytest research/tests/test_sdk_py.py` against an in-process server.

### AB-SUR-5: Codex and Cursor (and Gemini CLI) hook adapters
- **title:** Governed hooks for Codex, Cursor and Gemini CLI
- **goal:** Reuse core's shell and path checks from `packages/mcp/src/hook.ts` behind a harness-neutral decider, then add the input and output shape of Codex (PreToolUse, `permissionDecision`), Cursor (beforeMCPExecution, beforeShellExecution, `permission`) and Gemini CLI (BeforeTool, `decision`). Ship fixtures under `fixtures/harness/` taken from each vendor's own docs page (the Codex deny shape was confirmed only from third-party write-ups, so capture the official page first) and `engram setup` support. Correct ADR 0022 on Codex.
- **absorbs:** vendor hook specs (see note repo-harness-hooks-2026).
- **files:** `packages/mcp/src/hook.ts` (split), new `hook-codex.ts`, `hook-cursor.ts`, `hook-gemini.ts`, `packages/cli/src/hook.ts`, `setup.ts`, `fixtures/harness/{codex,cursor,gemini}`, ADR 0022 amendment, `make test-e2e`.
- **effort:** M
- **depends on:** AB-SUR-2 not required.
- **value:** Product: three more harnesses with no-bypass enforcement. Thesis: ADR 0022's "Codex has no hook, so store commands are not blocked" becomes false (condition C7 itself, "governed tools without read filtering", is unchanged), which changes what H4 can claim and needs a pre-registration note first.
- **risks:** Cursor MCP hooks are deferred in cloud agents and a forum thread reports hooks not firing; Codex project hooks need user trust; I have not run any of them. Do not add context injection in this PR (it would alter C7). Land Codex first (same deny shape as Claude Code); Cursor and Gemini CLI follow separately.
- **acceptance:** `make test-e2e` replays each harness's recorded stdin through the hook and asserts the vendor's deny shape.

### AB-SUR-6: MCP resources and prompts for memory
- **title:** MCP resources (read-only, governed) and prompts
- **goal:** Expose `engram://scope/{scope}/items/{id}` as resource templates and `engram://explain/{readId}`, each read going through `Plane.read` as the authenticated actor. Add prompts such as "recall before task" and "review pending promotions". Include cacheable results (`ttlMs`, `cacheScope: private`) per the new spec, and `listChanged` through `subscriptions/listen` if the SDK supports it.
- **absorbs:** MCP spec resources and prompts. The official memory server alias set (`search_nodes`, `read_graph`) is dropped from scope by verification: its entity and relation graph does not exist in Engram's schema.
- **files:** `packages/mcp/src/server.ts`, new `resources.ts`, `prompts.ts`, tests, ADR 0022 amendment.
- **effort:** M
- **depends on:** AB-SUR-2.
- **value:** Product: clients with resource pickers and slash commands get memory without tool calls; compat with the most-installed memory server. Thesis: another governed read path to measure.
- **risks:** A resource read is a read, so it must be logged, explained and filtered like any other; `cacheScope` must be private or a cache leaks across viewers. `cacheScope` and `ttlMs` were not checked against the spec text by verification.
- **acceptance:** `make test-one T=packages/mcp/test/resources.test.ts` (an ungranted viewer lists and reads none; every read emits an event).

### AB-SUR-7: Docs site
- **title:** Documentation site from docs/
- **goal:** Starlight (or Fumadocs, which is React and fits the UI) site with architecture, ADRs, the CLI reference generated from `engram --help`, the OpenAPI reference from sdk/openapi.json, and a quickstart. Built in CI-free `make docs`. Keep docs/ as the source.
- **absorbs:** Starlight 0.43.1 (MIT).
- **files:** `docs-site/` (new), `Makefile`, `docs/deps.md`, `.gitignore`, AGENTS.md (command list).
- **effort:** M
- **depends on:** none.
- **value:** Product: the first thing evaluators see. Thesis: little, apart from a stable link for reproducibility instructions.
- **risks:** docs/roadmap.md already plans a docs site in the P phase, so this is not a duplicate but should become a card there. Em-dash and log-lint rules apply to prose; docs/log entries should be excluded from the site. A second Node toolchain (Astro). Rule 13 must hold for generated pages.
- **acceptance:** `make docs` builds with zero broken links and `make lint-docs` passes.

## Recommended order

1. **AB-SUR-2** (SDK v2 and spec 2026-07-28). It is the foundation: the pinned SDK is a major version behind, RV5's stateful HTTP design points the wrong way, and AB-SUR-1 and AB-SUR-6 should be built once on the new API.
2. **AB-SUR-1** (verified identity). It removes the single biggest stated limit of the surfaces and strengthens the thesis claim that every decision names a real actor.
3. **AB-SUR-3** (provenance graph and diff). Smallest risk, highest demo value, and no dependency on the others, so it can run in parallel with 1 and 2.

AB-SUR-5 is the best quick win if the lead wants more harnesses early; AB-SUR-4 is small and unblocks Python users.

## Notes written

Literature notes in `.claude/worktrees/research/docs/readings/litreview/`: `repo-mcp-spec-2026-07-28.md`, `repo-mcp-typescript-sdk-v2.md`, `repo-better-auth-oauth-provider.md`, `repo-harness-hooks-2026.md`, `repo-xyflow.md`.

## Verification (2026-11-21)

Checked with `gh api`, `npm view`, the repo's code and web search.

**Verified as stated:** licences, stars and push dates for every GitHub repo in the table (mem0 69.3k, graphiti 33.0k, codex 136k, gemini-cli 109k, shadcn 128.7k, Cline 71.8k and Continue 36.5k Apache-2.0); npm licences and versions (server and client 2.4.0 and hono 2.0.2 Apache-2.0, better-auth 1.7.27, jose 6.2.18, xyflow 13.0.2, dagre 3.1.3, react-table 9.3.1, react-virtual 3.14.26, diff 9.0.0, starlight 0.43.1, fumadocs-core 16.19.5, a2a-js 1.3.0, ag-ui core 1.0.5, elkjs EPL-2.0 OR GPL-3.0-or-later); spec revision 2026-07-28 exists in the spec repo and removes initialize and Mcp-Session-Id; SDK v2.0.0 published 2026-07-27 and v1.x maintained at least six months; mem0 `integrations/` holds claude-code, codex, cursor, opencode and pi plugins; graphiti `mcp_server` exists with a `docker` folder; every existing Engram file the plans name exists and the new ones are correctly new; Engram's gaps are real (docs/architecture.md line 162 says auth is none and the actor self-asserted; ADR 0022 says Codex has no hook; no resources, prompts, lineage graph, Python client or docs site exists).

**Corrected:**
- Licence column for the MCP spec, SDK, conformance and servers repos: GitHub reports NOASSERTION, but the LICENSE file is an MIT to Apache-2.0 transition (both compatible). The conformance suite is MIT on npm (0.1.16), no longer "to confirm".
- AB-SUR-3 named a `supersedes` field; the schema field is `lineage`.
- AB-SUR-2 left raw JSON Schema registration unverified; v2 documents `fromJsonSchema`. It also overlooked that v2 serves legacy and modern eras and that current clients may be legacy, so sessions cannot simply be dropped.
- AB-SUR-4 claimed research scripts would use the client; none calls the plane over HTTP, so thesis value is nil and `sdk/py` needs adding to `GENERATED`.
- AB-SUR-5: the Codex deny shape was confirmed only from third-party sources; the sentence at stake is ADR 0022's "Codex has no hook", not C7's definition.
- Pinning rule (two weeks): `@xyflow/react` 13.0.x, better-auth and oauth-provider 1.7.26 and 1.7.27, and jose 6.2.18 are under two weeks old; plans now say what to pin.
- AB-SUR-6: official memory server alias set removed.

**Refuted:** research code using a Python SDK (AB-SUR-4); "conformance licence unknown".

**Not verified:** Cursor and Gemini CLI hook shapes (vendor pages not re-fetched), `cacheScope` and `ttlMs` in the spec, better-auth on SQLite, A2A and AG-UI wire details.

**Notes:** the five `repo-*` notes were checked: frontmatter ids match filenames, code URLs point at the named repos, no em dash present. Fixed in place: the xyflow note's `supersedes` wording (now `lineage`), the SDK v2 note's open question (answered by `fromJsonSchema`) and the conformance licence line.

**Plan verdicts:** all seven keep-with-fix: AB-SUR-1 (jose only first, ADR first, pins), AB-SUR-2 (dual era, fromJsonSchema spike), AB-SUR-3 (pin xyflow 12.x, `lineage`), AB-SUR-4 (product only), AB-SUR-5 (Codex first), AB-SUR-6 (no alias set), AB-SUR-7 (becomes a P-phase card).
