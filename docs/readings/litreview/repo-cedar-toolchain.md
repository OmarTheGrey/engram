---
id: repo-cedar-toolchain
title: Cedar toolchain (cedar, cedar-wasm, cedar-policy-symcc, cedar-spec, cedar-for-agents)
authors: Cedar Policy project (AWS)
venue: open source, releases 2026-11
year: 2026
tier: new
topics: [governance, policy, formal-verification, store]
engram: [govern, twin, plane]
code: https://github.com/cedar-policy/cedar
sources_read: [https://github.com/cedar-policy/cedar, https://github.com/cedar-policy/cedar/tree/main/cedar-policy-symcc, https://github.com/cedar-policy/cedar/tree/main/cedar-wasm, https://github.com/cedar-policy/cedar-for-agents, https://github.com/cedar-policy/cedar-spec/tree/main/cedar-lean-cli]
---

## Claim
Cedar ships a path from policy text to evaluation in WASM (npm), and to solver-backed analysis through a Rust crate and CLI that need a native cvc5.

## Method
Read READMEs, release lists and package metadata through the GitHub API and npm. Nothing was run.

## Key numbers
- cedar: Apache-2.0, 1,890 stars, pushed 2026-11-20, v4.15.0 released 2026-11-16 (GitHub API).
- npm `@cedar-policy/cedar-wasm`: 4.15.0 published 2026-11-16, under the two-week rule; 4.14.1 (2026-11-02) is a broken publish (2 files, no wasm), so the usable pin is 4.14.0 (2026-10-19). Apache-2.0. The wasm source lists `is_authorized` and `is_authorized_partial`; no SymCC export seen in `lib.rs`.
- cedar-policy-symcc v0.9.0 (2026-11-16): six properties with counterexamples; needs cvc5 1.3.1 (the API reports the cvc5 licence as NOASSERTION; it is believed BSD-3, verify).
- CLI: `cedar symcc` exists only in the "experimental" release archive built with `analyze`; the `tpe` (type-aware partial evaluation) feature is also experimental.
- cedar-spec (Lean model): Apache-2.0, 228 stars. cedar-for-agents: Apache-2.0, 62 stars; its analysis MCP server needs Docker, which Engram forbids.

## What Engram borrows
Depend on cedar-wasm as a dev dependency for differential testing of an export (AB-POL-1). Run `cedar symcc` as an optional local or research step (AB-POL-2). Partial evaluation for residual "who" queries is a possible later step (AB-POL-3).

## What Engram does differently
SymCC is not callable from Node. Analysis stays a script in `research/` that shells out to a binary, never a runtime path.

## Risk to our claims
Experimental surfaces change between releases (the README says so). Pin an exact CLI and cvc5 version in `docs/deps.md` and the thesis.

## Open question
Does z3-solver (MIT, WASM, npm 5.4.1) accept SymCC's SMT-LIB output, making analysis fully in process? Unverified.

## Notes
Cedar has no iteration or quantifiers, so per-item grant lists must be flattened at export.
