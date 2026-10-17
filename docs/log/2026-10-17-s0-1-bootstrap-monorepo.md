---
date: 2026-10-17
author: omar
type: change
card: S0.1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - Makefile
  - .github/workflows/ci.yml
  - "make test"
  - "make lint"
supersedes: none
---

**What.** Step-0 task S0.1 bootstrapped the monorepo: pnpm workspace with nine package stubs (core, adapters, pi-extension, runner, bench, mcp, cli, server, ui), a uv workspace with `research` as its member, Biome, TypeScript, Vitest, fast-check, ruff, mypy, pytest, Hypothesis, a Makefile and a GitHub Actions workflow running `make lint` and `make test`.

**Why.** Every later card runs its acceptance command through the Makefile, so the commands must exist before the first real card.

**Result.** Before: `make test` failed with `Command "vitest" not found`. After: `make test` passes on an empty suite (Vitest with `passWithNoTests`, pytest exit code 5 accepted) and `make lint` passes. TypeScript is 7.0.2, not the 5.x in ADR 0019, on the lead's instruction; ADR 0019 is amended.

**Consequence.** Unimplemented targets exit 2 naming their card. Windows members need GNU make (`winget install ezwinports.make`).
