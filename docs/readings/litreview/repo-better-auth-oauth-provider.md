---
id: repo-better-auth-oauth-provider
title: better-auth and its OAuth 2.1 provider and MCP plugins
authors: Better Auth contributors
venue: GitHub repository and documentation, 2026
year: 2026
tier: new
topics: [authentication, oauth, mcp, identity]
engram: [govern, twin]
code: https://github.com/better-auth/better-auth
sources_read: [https://better-auth.com/docs/plugins/oauth-provider.md, search summaries of https://better-auth.com/docs/plugins/mcp, npm registry metadata, gh api repository metadata]
---

## Claim
better-auth is a framework-agnostic TypeScript auth library (MIT, about 30.8k stars, pushed 2026-11-20, version 1.7.27) whose oauth-provider plugin makes an app an OAuth 2.1 authorization server usable by MCP clients.

## Method
Read the plugin page and summarised the MCP plugin docs. Not run by us.

## Key numbers
- PKCE required by default, S256 only (oauth-provider doc).
- RFC 8707 resource binding, RFC 9728 metadata, Client ID Metadata Documents and RFC 7591 registration supported (oauth-provider doc).
- JWT access tokens (RFC 9068) when a resource is named and the JWT plugin is on.

## What Engram borrows
An embedded authorization server for `engram serve` so a loopback or team deployment gets real sign-in, with Engram as the resource server. Lands in AB-SUR-1.

## What Engram does differently
Authorization (who may read which scope) stays in core's grants. The token only proves who the caller is.

## Risk to our claims
Docs disagree on whether mcp() replaces oauthProvider(), and a v1.8 beta exists. Pin an exact version and avoid the beta. The page does not say whether SQLite is a supported storage backend, so that needs a spike. It adds tables to the log database or a second database.

## Open question
Is an embedded authorization server worth it for a loopback tool, versus accepting tokens from an external issuer using jose alone (MIT, 6.2.18)?

## Notes
cloudflare/workers-oauth-provider (MIT) is a Workers-only alternative, not a fit for Node.
