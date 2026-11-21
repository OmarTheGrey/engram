---
id: repo-node-sea
title: Node.js single executable applications (SEA) and the --build-sea flow
authors: Node.js project
venue: Node.js documentation, v24 and v26 pages
year: 2026
tier: new
topics: [packaging, deployment, performance, tooling]
engram: [plane]
code: https://github.com/nodejs/node
sources_read: [https://nodejs.org/docs/latest-v24.x/api/single-executable-applications.html, https://nodejs.org/docs/latest-v24.x/api/sqlite.html, search excerpts of the v26 and v27 nightly SEA pages]
---

## Claim
Node can embed one script plus assets into a copy of the node binary, giving a single file with no install step. On the Node 24 line it supports only a CommonJS main script, so an ESM, type-stripped TypeScript code base such as Engram must be bundled first.

## Method
The v24 page documents `--experimental-sea-config` producing a blob, injected with postject, with assets read through `node:sea`. A native addon must be written to a temp file and loaded with `process.dlopen`. A later flow, `--build-sea`, is described as added in v25.5.0 (changelog line in search results; not read from the release notes). A `mainFormat: "module"` option appears in v27 nightly docs only. The blob must be made by the same Node version as the binary it is injected into, and cross-platform SEAs need `useCodeCache` and `useSnapshot` off. Stability is 1.1, active development.

## Key numbers
- Stability 1.1 Active development (v24 docs).
- Windows signing is optional: remove the signature with signtool before injection, sign after (v24 docs).
- node:sqlite is Stability 1.2 release candidate since v25.7.0 and v24.15.0 (sqlite page). The SEA page says nothing about node:sqlite, so whether it works inside a SEA is unverified; it is a built-in, so it should, and a smoke test must prove it.
- postject: 247 stars, last push 2024-12-21, GitHub API licence NOASSERTION; npm lists postject 1.0.0-alpha.6 as MIT (checked 2026-11-21).

## What Engram borrows
A `make dist` target: esbuild bundle of packages/cli to one CJS file (the Postgres worker bundled as an asset or a second entry, since ADR 0024 notes the worker is loaded by .ts path and Node refuses type stripping under node_modules), then SEA injection, then a smoke run of `engram doctor` and a write, read, explain cycle.

## What Engram does differently
Engram already declares Node 24 as the floor, so a SEA built from the project's own Node avoids a second runtime. We do not adopt Bun or Deno as the base (ADR 0001).

## Risk to our claims
SEA is stability 1.1 and CJS-only on Node 24, and the pi packages are ESM. If bundling pi into CJS breaks (top-level await, import.meta), the fallback is a thin launcher plus a tarball. Test early.

## Open question
Does the pi-coding-agent package bundle cleanly with esbuild to CJS, and does `engram mcp` over stdio start fast enough from a larger binary?

## Notes
esbuild: MIT, 40,163 stars, last push 2026-08-09 (GitHub API). yao-pkg/pkg (maintained fork of the archived vercel/pkg): MIT, 934 stars, pushed 2026-11-21; vercel/pkg is archived, last push 2024-01-03.
