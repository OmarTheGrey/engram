---
id: repo-mcp-typescript-sdk-v2
title: MCP TypeScript SDK v2 (@modelcontextprotocol/server, client, hono)
authors: Model Context Protocol project
venue: GitHub repository, 2026
year: 2026
tier: new
topics: [mcp, sdk, surfaces, hono]
engram: [plane]
code: https://github.com/modelcontextprotocol/typescript-sdk
sources_read: [https://github.com/modelcontextprotocol/typescript-sdk (ROADMAP.md, packages/middleware/hono/README.md), npm registry metadata]
---

## Claim
The SDK has split into scoped packages and v2 is the stable line; v1.x gets fixes for at least six months after 2026-07-27.

## Method
Read the roadmap and the Hono middleware README, and queried npm for versions and licences.

## Key numbers
- Server and client packages at 2.4.0 (Apache-2.0), `@modelcontextprotocol/hono` at 2.0.2 (npm).
- v2.0.0 released 2026-07-27 with the 2026-07-28 spec (ROADMAP.md).
- Engram pins `@modelcontextprotocol/sdk` 1.32.1 (packages/mcp/package.json).

## What Engram borrows
`createMcpHonoApp`, Host-header DNS rebinding validation and the web-standard streamable HTTP transport fit Engram's existing Hono stack. Middleware packages exist for express, fastify, hono and node. Lands in card AB-SUR-2.

## What Engram does differently
ADR 0022 uses the low-level Server class so TypeBox schemas are defined once and shared with the pi extension. v2 is built on Zod, so the migration has to confirm raw JSON Schema tools still register.

## Risk to our claims
The v1.x line targets 2025-11-25 only. Staying on 1.32.1 means no 2026-07-28 support, and the HTTP session code from RV5 would need rework regardless.

## Open question
v2 documents `fromJsonSchema(...)` for tools without Zod (docs/servers/tools.md); a spike should confirm the low-level path.

## Notes
Conformance suite at modelcontextprotocol/conformance (GitHub reports NOASSERTION; the LICENSE is the MIT to Apache-2.0 transition text and npm 0.1.16 is MIT; 149 stars, checked via gh).
