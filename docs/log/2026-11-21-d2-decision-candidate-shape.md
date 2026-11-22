---
date: 2026-11-21
author: claude-agent
type: decision
card: D2
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/tasks/D2.md
  - packages/core/src/schema.ts
supersedes: none
---

**What.** A candidate is a procedural `MemoryItem` with status `candidate`, version 1, confidence 0.5, no ttl, no grants and an empty `lineage`. Its `content.body` is the SKILL.md body (`# <title>`, a description paragraph, `## Steps`), and `content.tools` is its allowlist, in order. Its lineage to sessions is `provenance.ref`, `distill:<awm|rule>:<session id>,<session id>`, read by `parseDistillRef`. `provenance.hash` hashes those sessions, and the kind is `model`, or `compaction` when a summary is in them.

**Why.** Card D3 codes against this shape. The schema's `lineage` names versions an item supersedes, so session ids cannot go there.

**Result.** No schema change. `toSkillMd(item)` derives the name from the title and the description from the paragraph.

**Consequence.** D3 takes its held-out tasks from outside the ref's sessions.
