---
id: repo-bun-compile
title: Bun single-file executables and bun:sqlite as a faster runtime option
authors: Oven (Bun) contributors
venue: Bun documentation and GitHub repository
year: 2026
tier: new
topics: [packaging, runtime, performance, sqlite]
engram: [plane]
code: https://github.com/oven-sh/bun
sources_read: [https://api.github.com/repos/oven-sh/bun, search excerpts of Bun docs bundler/executables, search excerpts on bun:sqlite benchmarks]
---

## Claim
`bun build --compile` produces a single file for several OS and CPU targets from one host, and bun:sqlite has a better-sqlite3-like API. It is a packaging and speed option, not a base, and the numbers that favour it are vendor-run.

## Method
Documentation excerpts (the Bun docs pages returned 404 to direct fetch, so these come through search summaries) list targets such as bun-linux-x64, bun-linux-arm64, bun-windows-x64 and bun-darwin-arm64, plus baseline CPU variants, and recommend `--compile --bytecode --minify`. Bun's own claim is that bun:sqlite is 3 to 6 times faster than better-sqlite3 on reads (M1 MacBook, older macOS). A 2024 gist found the opposite for on-disk writes (Bun 1.0.29, Node 21.6.1), which is dated.

## Key numbers
- Bun: 96,818 stars, last push 2026-11-21, Rust; the GitHub API reports NOASSERTION, but the repository's LICENSE.md states "Bun itself is MIT-licensed" and notes that statically linked JavaScriptCore is LGPL-2 (checked 2026-11-21). Ideas only: we would not ship Bun.
- Deno: MIT, 109,120 stars, last push 2026-11-17 (GitHub API).
- No independent 2026 benchmark of node:sqlite against bun:sqlite was found.

## What Engram borrows
Ideas only: a second `Db` backend over bun:sqlite is a small swap behind ADR 0024's contract, and `bun build --compile` is a cheap way to try a cross-platform binary. Gate it on the same contract suite.

## What Engram does differently
The reference harness is pi on Node (ADR 0001); thesis results come from Node 24, so a Bun-built binary must not silently change measured behaviour.

## Risk to our claims
A runtime swap could change timing or numeric behaviour of replayed results. Keep research and `make test` on Node.

## Open question
Is bun:sqlite faster than node:sqlite on Engram's own append-plus-projection transaction? Measure, do not assume.

## Notes
Cross-compiled native modules may not work (Bun docs via mirror). Engram's core has no native modules; only the Mem0 adapter pulls in better-sqlite3.
