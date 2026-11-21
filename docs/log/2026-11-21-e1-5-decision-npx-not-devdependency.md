---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - Makefile
  - docs/deps.md
supersedes: none
---

**What.** Quint runs through `npx --yes @informalsystems/quint@0.33.1` from the Makefile, not as a workspace dev dependency.

**Why.** Quint pulls in gRPC, protobuf and about twenty more packages that only `make verify-spec` needs. As a dev dependency they would enter pnpm-lock.yaml, which ten parallel cards are editing, and every `pnpm install`.

**Result.** The lockfile and package.json are untouched. Quint is pinned by exact version in the Makefile (QUINT_VERSION), Apalache by `--apalache-version=0.62.4`; the cost is that Quint's own transitive ranges are resolved by npm at first fetch, not locked.

**Consequence.** A reviewer who wants the lockfile's integrity checks can move it into devDependencies later; the Makefile's QUINT variable is the one place to change.
