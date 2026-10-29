# Dependencies

One line per dependency: name, version, reason, licence. Added in the same PR as the dependency.

| package | version | reason | licence |
|---|---|---|---|
| typescript | 7.0.2 | type checking (`make lint`); native compiler, per the lead's amendment to ADR 0019 | Apache-2.0 |
| @biomejs/biome | 2.5.15 | lint and format for TypeScript and JSON | MIT OR Apache-2.0 |
| vitest | 5.0.5 | test runner for layers 1 to 5 and 7 | MIT |
| fast-check | 4.10.2 | property tests (layer 2, the invariants file) | MIT |
| @vitest/coverage-v8 | 5.0.5 | coverage report per package (testing convention: 100 percent branches on `policy/`); matches vitest | MIT |
| @types/node | 24.19.2 | Node 24 type definitions | MIT |
| pytest | 9.1.1 (uv.lock) | research tests (layer 8) | MIT |
| hypothesis | 6.170.1 (uv.lock) | property tests for research code | MPL-2.0 |
| ruff | 0.17.1 (uv.lock) | Python lint and format | MIT |
| mypy | 2.4.0 (uv.lock) | Python type checking | MIT |
| uv_build | >=0.10,<0.11 | build backend for the research package | MIT OR Apache-2.0 |
| @earendil-works/pi-coding-agent | 1.3.0 | the harness the plane runs in (ADR 0001); pi-extension, and the runner's SDK sessions (card RN1) | MIT |
| @earendil-works/pi-ai | 1.3.0 | model access and the faux provider behind the scripted model; pi-extension and runner only | MIT |
| typebox | 1.3.27 | tool parameter schemas for pi tools, the version pi itself uses; pi-extension and the runner's ungoverned C2 and C3 tools (card RN1) | MIT |
| zod | 4.6.7 | the schema in packages/core (ADR 0002) and its JSON Schema export; also the GateMem file loader and run config in packages/bench (card B1) and the runner config in packages/runner (card RN1) | MIT |
| ajv | 8.20.0 | dev: validates fixtures against the generated JSON Schema (draft 2020-12) | MIT |
| ajv-formats | 3.0.1 | dev: date-time and uuid formats for ajv | MIT |
| datamodel-code-generator | 0.86.0 | dev: generates research/engram_types from sdk/schema | MIT |
| typing-extensions | >=4.12 (uv.lock) | runtime import of the generated research/engram_types | PSF-2.0 |
| yaml | 2.9.1 | parses policy files in packages/core with node ranges, so a rejected policy names its line (card E2.1), and the YAML frontmatter of Claude Code memory files in the files adapter (card A3) | ISC |
| mem0ai | 3.3.1 | open-source Mem0 (`mem0ai/oss`) behind the Mem0 adapter, card A1 (ADR 0013); packages/adapters only | Apache-2.0 |
| better-sqlite3 | 12.11.1 | the SQLite binding of Mem0's local vector store; a native build allowed in pnpm-workspace.yaml (prebuilt binary, else node-gyp) | MIT |
| compromise | 14.19.0 (pnpm-lock.yaml) | peer of mem0ai, installed by pnpm; entity extraction in Mem0 search scoring | MIT |
| @cloudflare/workers-types | 4.20260702.1 (pnpm-lock.yaml) | peer of mem0ai, installed by pnpm; type definitions only, unused at runtime | MIT OR Apache-2.0 |
| openai | 4.104.0 (pnpm-lock.yaml) | dependency of mem0ai, installed by pnpm; Mem0's OpenAI provider client, never constructed by the Mem0 adapter (its embedder is injected and its model slot refuses) | Apache-2.0 |
| axios | 1.20.0 (pnpm-lock.yaml) | dependency of mem0ai, installed by pnpm; HTTP client inside Mem0, not imported by Engram code | MIT |
| zod | 3.25.76 (pnpm-lock.yaml) | dependency of mem0ai, installed by pnpm; Mem0's config validation, a second major version beside core's zod 4.6.7, not imported by Engram code | MIT |
| uuid | 11.1.1 (pnpm-lock.yaml) | dependency of mem0ai, installed by pnpm; Mem0's memory ids | MIT |
| postgres | 3.4.9 | postgres.js, the driver of the Postgres event log backend (`openPostgres`, card E1.1, ADR 0024); loaded only in its worker thread, so a SQLite user never loads it; no native build | Unlicense |
| embedded-postgres | 17.10.0-beta.17 | dev: a throwaway Postgres 17 server for the core tests, on Windows and on CI's Linux, without Docker (card E1.1, ADR 0024 amendment); its platform binaries (`@embedded-postgres/<platform>`, MIT; Postgres itself under the PostgreSQL License) come from pnpm-lock.yaml, and their install script, which only restores shared-library symlinks, is allowed in pnpm-workspace.yaml; it pulls in `pg` and `async-exit-hook` (MIT), which Engram code does not import | MIT |
| hono | 4.13.13 | the HTTP server's routing (card E8.1, ADR 0027): a fetch-function app, so the CLI and the MCP server call it in process through the client with no socket; its body-limit middleware caps request bodies; no dependencies of its own | MIT |
| @hono/node-server | 2.1.5 | puts the Hono app on a Node loopback socket for `engram serve` (card E8.1) | MIT |
| openapi-typescript | 7.13.0 | dev: generates the client's types from sdk/openapi.json in `make api` (card E8.3, ADR 0027); packages/server's scripts only; pulls in `@redocly/openapi-core`, `change-case`, `parse-json`, `supports-color`, `ansi-colors`, `yargs-parser` (MIT or ISC), which Engram code does not import | MIT |
| typescript | 5.9.3 | dev, packages/server only: the peer openapi-typescript builds its output with (the TypeScript compiler API, which the native TypeScript 7 above does not ship); `make lint` still type-checks with 7.0.2 | Apache-2.0 |
| openapi-fetch | 0.17.0 | the run-time client the generated sdk/ts and packages/ui/src/api wrap (card E8.3, ADR 0027): typed fetch calls over the OpenAPI paths, with an injectable fetch for in-process calls; pulls in `openapi-typescript-helpers` (MIT, types only) | MIT |

Install size of the Mem0 adapter: mem0ai, better-sqlite3, compromise, @cloudflare/workers-types, openai 4, axios, zod 3 and uuid together take about 45 MB of `node_modules/.pnpm` (measured with `du -shc` over their folders on 2026-10-25, before their own dependencies). Only packages/adapters depends on them.
