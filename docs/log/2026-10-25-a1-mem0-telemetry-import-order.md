---
date: 2026-10-25
author: claude-agent
type: failure
card: A1
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/mem0/telemetry-off.ts
  - packages/adapters/test/mem0/import-order.child.ts
  - packages/adapters/test/mem0/mem0.test.ts
  - "pnpm exec vitest run packages/adapters/test/mem0"
supersedes: none
---

**What.** The Mem0 adapter switched Mem0's telemetry off only when it first loaded `mem0ai/oss` itself, so a program that loaded Mem0 earlier kept telemetry on (review finding R4-7).

**Why.** Mem0 reads MEM0_TELEMETRY once, when its module is evaluated, and sends an init event, notice lookups and usage events to its analytics host.

**Result.** A child process that loaded `mem0ai/oss` before the adapter attempted five network calls and created its MEM0_DIR folder, in both import orders tried. Now a side-effect module imported first sets the variable, and each Mem0 instance has its telemetry and notice methods replaced by no-ops; both orders make zero calls and create no folder. Disabling the instance step alone makes the Mem0-first order fail again.

**Consequence.** AGENTS.md rule 12 holds for the Mem0 adapter whatever the import order; a Mem0 upgrade that renames these methods fails loudly.
