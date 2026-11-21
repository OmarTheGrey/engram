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
  - docs/tasks/lead-decisions.md
  - docs/log/2026-11-21-e2-8-version-bump-moves-cassette-keys.md
  - packages/core/test/unit/policy/presets.test.ts
supersedes: none
---

**What.** The policy's `content_guards` and `trust` blocks are added as optional fields with no default; `schema_version` stays 1, with no migration.

**Why.** A bump would move 46 committed cassette keys and H3's pinned fault-set hashes, nine days before the tag (the finding of the same day). The coordinator decided it under the lead's delegation of 2026-11-21, recorded in `docs/tasks/lead-decisions.md` (row "E2.8, the schema version").

**Result.** ADR 0002 gains decision D2, a named exception to rule 5 for contracts never persisted, today the policy document alone: a purely additive, optional field with no default, whose absence parses and serialises byte for byte as before, needs no bump and no migration. A persisted contract still bumps and migrates. AGENTS.md rule 5 gains one sentence naming it. The cost: code built before the change rejects a policy using the new blocks.

**Consequence.** Cards E2.9 to E2.11 read the blocks with no schema change.
