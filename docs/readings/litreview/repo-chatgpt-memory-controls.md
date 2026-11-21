---
id: repo-chatgpt-memory-controls
title: ChatGPT memory, project-only memory and enterprise controls
authors: OpenAI (help center)
venue: OpenAI Help Center article 8590148, read 2026-11-21
year: 2026
tier: new
topics: [governance, competitor, twin, retention]
engram: [twin, govern]
code: none found
sources_read: [https://help.openai.com/en/articles/8590148-memory-faq]
---

## Claim
ChatGPT separates saved memories from chat-history reference, offers temporary chats chosen before the first message, and has project-only memory plus role-gated admin enablement in regulated Enterprise workspaces. It states that deleting a chat does not delete the memory made from it and that improved memory is outside the BAA.

## Method
Help article read in full. Turning off chat-history reference schedules deletion within 30 days; deleted saved memories may be kept in logs up to 30 days; full removal needs deletion of the memory, the source chat and source files.

## Key numbers
- 30 days: deletion horizon and safety-log horizon (help article).

## What Engram borrows
Deletion-propagation as a test: erase must remove a memory and report every derived or source item still present, a lineage query the provenance model supports (ADR 0004). Role-gated enablement maps to grants (ADR 0021).

## What Engram does differently
Offboarding and retention act on the append-only log with a reason per decision rather than scheduled backend deletion.

## Risk to our claims
Memory export is not described on the page read; do not claim ChatGPT lacks export.

## Open question
Should erase return a derived-from closure so the report matches the full-removal list OpenAI documents?

## Notes
Plan availability is not listed on the page. See also repo-chatgpt-claude-memory-formats.
