---
id: repo-mcp-spec-2026-07-28
title: Model Context Protocol specification, revision 2026-07-28 (key changes and authorization)
authors: Model Context Protocol project
venue: specification repository, 2026
year: 2026
tier: new
topics: [mcp, authorization, surfaces, protocol]
engram: [govern, twin, plane]
code: https://github.com/modelcontextprotocol/modelcontextprotocol
sources_read: [https://github.com/modelcontextprotocol/modelcontextprotocol (docs/specification/2026-07-28/changelog.mdx, basic/authorization/index.mdx, basic/authorization/client-registration.mdx)]
---

## Claim
The 2026-07-28 revision makes MCP stateless (no initialize handshake, no Mcp-Session-Id), makes OAuth 2.1 the HTTP authorization model with protected resource metadata mandatory, and moves client registration from Dynamic Client Registration to Client ID Metadata Documents.

## Method
Read the changelog and the authorization pages in the specification repository. The spec has revisions 2024-11-05, 2025-03-26, 2025-06-18, 2025-11-25, 2026-07-28 and a draft.

## Key numbers
- Nine major changes and twelve minor ones in the changelog (counted from the file).
- Deprecation window of at least twelve months under the new lifecycle policy (changelog, governance section).
- Error codes -32020 to -32099 reserved for the spec (changelog, minor change 12).

## What Engram borrows
Authorization for the HTTP transport: the MCP server is an OAuth 2.1 resource server, publishes RFC 9728 protected resource metadata, validates tokens bound to its resource (RFC 8707), and lets any conforming authorization server issue them. The verified token subject becomes the actor, which closes the self-asserted identity limit in docs/architecture.md. Resources and prompts get cacheable results (ttlMs, cacheScope). Lands in a new ADR and cards AB-SUR-1 and AB-SUR-2.

## What Engram does differently
Stdio stays on launch flags (the spec says stdio SHOULD NOT follow the authorization spec). The actor still comes from a membership table in the plane, never from token claims alone.

## Risk to our claims
RV-SRF-6 (card RV5) gave `engram mcp --http` one stateful server per session. The new revision removes protocol-level sessions, so that design is on the deprecated side. memory_simulate's workload across calls needs an explicit handle or the log, not session state. Decide in the ADR.

## Open question
Is a bearer-token subject enough to name `person:<id>`, or do we need a signed mapping from issuer and subject to actor ids?

## Notes
The spec repo licence file states a transition from MIT to Apache-2.0, with documentation under CC-BY-4.0. DCR is deprecated but remains for compatibility. Sampling, roots and logging are deprecated, so Engram should not adopt them.
