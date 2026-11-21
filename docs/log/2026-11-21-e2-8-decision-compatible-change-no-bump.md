---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.8
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0002-schema-and-generated-contracts.md
  - docs/log/2026-11-21-e2-8-version-bump-moves-cassette-keys.md
  - packages/core/test/unit/policy/presets.test.ts
supersedes: none
---

**What.** The policy's `content_guards` and `trust` blocks are added as optional fields with no default, and `schema_version` stays 1, with no migration.

**Why.** A bump would move 46 committed cassette keys and H3's pinned fault-set hashes (the finding of the same day). The coordinator chose this option, under the lead's delegation of 2026-11-21.

**Result.** ADR 0002 gains decision D2: a purely additive, optional field with no default, whose absence parses and serialises byte for byte as before, is a compatible change and keeps the version; the next breaking change bumps it. AGENTS.md rule 5 is unchanged. The cost: code built before the change rejects a policy file that uses the new blocks, and every such reader is in this repository.

**Consequence.** Cards E2.9, E2.10 and E2.11 read the blocks with no schema change of their own.
