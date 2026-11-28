---
date: 2026-11-28
author: claude-agent
type: failure
card: E2.18
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - tools/symcc/Cargo.lock
  - tools/symcc/properties.ts
  - research/scripts/h2_cedar_properties.py
supersedes: none
---

**What.** Three small stops: `cargo build --locked`, then `--offline`, refused because the first lock lacked tokio-macros; node refused a TypeScript parameter property in strip-only mode; tsc and mypy refused untyped index reads in the decoder and the script.

**Why.** Each is a toolchain rule met for the first time in tools/symcc.

**Result.** tokio-macros 2.7.0 (published 2026-04-03, MIT) was fetched once and the lock regenerated; the class field is now assigned in the constructor; the helpers take `Json | undefined` and the paths are typed. make lint passes.

**Consequence.** Nothing further.
