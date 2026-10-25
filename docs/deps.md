# Dependencies

One line per dependency: name, version, reason, licence. Added in the same PR as the dependency.

| package | version | reason | licence |
|---|---|---|---|
| typescript | 7.0.2 | type checking (`make lint`); native compiler, per the lead's amendment to ADR 0019 | Apache-2.0 |
| @biomejs/biome | 2.5.15 | lint and format for TypeScript and JSON | MIT OR Apache-2.0 |
| vitest | 5.0.5 | test runner for layers 1 to 5 and 7 | MIT |
| fast-check | 4.10.2 | property tests (layer 2, the invariants file) | MIT |
| @types/node | 24.19.2 | Node 24 type definitions | MIT |
| pytest | 9.1.1 (uv.lock) | research tests (layer 8) | MIT |
| hypothesis | 6.170.1 (uv.lock) | property tests for research code | MPL-2.0 |
| ruff | 0.17.1 (uv.lock) | Python lint and format | MIT |
| mypy | 2.4.0 (uv.lock) | Python type checking | MIT |
| uv_build | >=0.10,<0.11 | build backend for the research package | MIT OR Apache-2.0 |
| @earendil-works/pi-coding-agent | 1.3.0 | the harness the plane runs in (ADR 0001); pi-extension only | MIT |
| @earendil-works/pi-ai | 1.3.0 | model access and the faux provider behind the scripted model; pi-extension and runner only | MIT |
| typebox | 1.3.27 | tool parameter schemas for pi tools, the version pi itself uses | MIT |
| zod | 4.6.7 | the schema in packages/core (ADR 0002) and its JSON Schema export | MIT |
| ajv | 8.20.0 | dev: validates fixtures against the generated JSON Schema (draft 2020-12) | MIT |
| ajv-formats | 3.0.1 | dev: date-time and uuid formats for ajv | MIT |
| datamodel-code-generator | 0.86.0 | dev: generates research/engram_types from sdk/schema | MIT |
| typing-extensions | >=4.12 (uv.lock) | runtime import of the generated research/engram_types | PSF-2.0 |
| yaml | 2.9.1 | parses policy files in packages/core with node ranges, so a rejected policy names its line (card E2.1), and the YAML frontmatter of Claude Code memory files in the files adapter (card A3) | ISC |
| mem0ai | 3.3.1 | open-source Mem0 (`mem0ai/oss`) behind the Mem0 adapter, card A1 (ADR 0013); packages/adapters only | Apache-2.0 |
| better-sqlite3 | 12.11.1 | the SQLite binding of Mem0's local vector store; a native build allowed in pnpm-workspace.yaml (prebuilt binary, else node-gyp) | MIT |
| compromise | 14.19.0 (pnpm-lock.yaml) | peer of mem0ai, installed by pnpm; entity extraction in Mem0 search scoring | MIT |
| @cloudflare/workers-types | 4.20260702.1 (pnpm-lock.yaml) | peer of mem0ai, installed by pnpm; type definitions only, unused at runtime | MIT OR Apache-2.0 |
