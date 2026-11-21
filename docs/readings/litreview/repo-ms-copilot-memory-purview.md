---
id: repo-ms-copilot-memory-purview
title: Microsoft 365 Copilot memory controls and Purview AI governance
authors: Microsoft (product documentation)
venue: Microsoft Learn, pages dated 2026-05 and 2026-09
year: 2026
tier: new
topics: [governance, competitor, retention, audit, store]
engram: [govern, twin, plane]
code: none found
sources_read: [https://learn.microsoft.com/en-us/microsoft-365/copilot/copilot-personalization-memory, https://learn.microsoft.com/en-us/purview/ai-m365-copilot]
---

## Claim
The largest enterprise vendor ships per-user memory (saved memories, inferred chat-history details, custom instructions) with a single tenant switch, and its own documentation states the governance gaps: retention policies do not apply to memory, memory actions write no Purview audit entries, and admins cannot restrict what is remembered.

## Method
Product documentation read in full. The memory page says memories live in a hidden folder of the user's Exchange mailbox and follow mailbox policies (Customer Lockbox, encryption at rest). The Purview page lists supported controls for AI interactions: DSPM for AI, audit of prompts and responses, classification, sensitivity labels, DLP, insider risk, communication compliance, eDiscovery, lifecycle management, Compliance Manager.

## Key numbers
- Chat-history details are deleted within seven days of the source chats being deleted, and after 30 days when Enhanced personalization is turned off (memory page).
- Memory page status: "in preview". Enhanced personalization is on by default.

## What Engram borrows
A gap list to position against: Engram retires by policy (ADR 0010, 0025), logs every decision with a reason (rule 3) and gates what may be written (ADR 0007). Borrow the Purview vocabulary (sensitivity label inheritance, eDiscovery search, Compliance Manager templates) for the compliance-report card AB-CMPT-6.

## What Engram does differently
Engram governs the memory write itself and explains each recall; Microsoft governs the surrounding interaction data and leaves memory content outside retention, audit and content restriction.

## Risk to our claims
Microsoft may close these gaps in Purview (the pages are marked preview). Any deck claim of the form "no vendor audits memory writes" must carry the page stamps (memory page updated_at 2026-11-03) and be rechecked before the deck is shown.

## Open question
Does the Purview audit gap extend to agent memory in Copilot Studio agents? Not covered by the pages read.

## Notes
Purview page updated_at 2026-06-25. Admin deletion is through Graph Explorer plus eDiscovery, item class IPM.Contact, folder CopilotMemory.
