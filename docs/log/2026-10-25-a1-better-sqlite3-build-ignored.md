---
date: 2026-10-25
author: claude-agent
type: failure
card: A1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - pnpm-workspace.yaml
  - "pnpm install"
supersedes: none
---

**What.** After `pnpm add mem0ai@3.3.1`, Mem0's local vector store could not open: pnpm 10 ignored the install script of `better-sqlite3`, so its native binding was never built.

**Why.** `mem0ai/oss` imports `better-sqlite3` for its default in-memory vector store, and pnpm 10 runs no dependency build script unless the workspace allows it. pnpm printed "Ignored build scripts: better-sqlite3@12.11.1".

**Result.** Allowing the build (`allowBuilds: better-sqlite3: true` in `pnpm-workspace.yaml`) fetched a prebuilt binary for Node 24 on Windows x64 and the store opened. `better-sqlite3` is now a direct dependency of `packages/adapters` at an exact version.

**Consequence.** A machine with no prebuilt binary for its platform needs a C++ toolchain for node-gyp.
