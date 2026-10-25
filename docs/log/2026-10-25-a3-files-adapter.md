---
date: 2026-10-25
author: claude-agent
type: change
card: A3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/files/index.ts
  - packages/adapters/test/conformance/files.test.ts
  - packages/adapters/test/files/index.test.ts
  - fixtures/stores/claude-code-memory/MEMORY.md
  - "pnpm exec vitest run packages/adapters/test"
supersedes: none
---

**What.** Card A3 added the files adapter: a folder in the Claude Code auto-memory layout, one Markdown file per item (`<id>.md`, body is the content, Claude Code `name`, `description`, `metadata.type` kept, every other field under `engram:`), atomic writes, and MEMORY.md kept in step.

**Why.** ADR 0013 names files as the first real store, and Claude Code memory folders are what Twin imports.

**Result.** The adapter passes the whole conformance suite and lexical recall; 20 adapter-specific tests pass, and each of four planted mutations makes at least one fail. A file without `engram:` lists read-only: class semantic for all four Claude Code types, scope and owner `person:<owner>`, provenance kind import, actor `agent:claude-code`, sha256 of the file, confidence 0.5, valid_from from options or mtime, id a UUIDv7 from the file name.

**Consequence.** E8.2 can list a memory folder through `engram read`.
