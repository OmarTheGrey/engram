---
date: 2026-11-28
author: claude-agent
type: decision
card: A6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/mcp-memory/index.ts
  - packages/adapters/test/mcp-memory/mcp-memory.test.ts
supersedes: none
---

**What.** Observations carry no ids, so the ref of one is `observation/<h>`, h the first 32 hex digits of sha256 over the JSON array [entity name, text], and a relation's `relation/<h>` over [from, relationType, to]; the item id is a UUIDv7 from the file's identity and the key, as the files adapter derives imported ids.

**Why.** That pair is what names an observation in the server's own model (it stores a text once per entity, and deletes an observation by its text); an index would move when another observation is deleted.

**Result.** A ref survives reordering, sibling observations added or deleted, a new entity type and any server rewrite; an edited text is a new ref, and adoption retracts the old one. A text repeated by hand lists once.

**Consequence.** Renaming an entity changes the refs of its observations. Relations are adopted too, as read-only items `<from> <relationType> <to>`.
