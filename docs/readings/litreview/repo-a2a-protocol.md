---
id: repo-a2a-protocol
title: "A2A (Agent2Agent) protocol, agent cards and signed agent cards"
authors: Linux Foundation project (originated by Google); a2aproject/A2A
venue: open specification, 1.0 in 2026
year: 2026
tier: new
topics: [governance, methods, store]
engram: [plane, H4]
code: https://github.com/a2aproject/A2A (Apache-2.0, 26,618 stars, pushed 2026-11-20 per gh api; specification repository)
sources_read: [https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year, https://aaif.io/blog/a2a-v1-0-a-builder-s-guide-part-1-discovery-tasks-and-clients, gh api repos/a2aproject/A2A]
---

## Claim
A2A is the interoperability layer between agents of different vendors. An agent publishes an agent card (well-known path `/.well-known/agent-card.json`) declaring identity and capabilities, and 1.0 adds signed agent cards for cryptographic identity verification.

## Method
Based on search snippets, the project's press release and builder guide, not the normative text. Clients send an `A2A-Version` header; a missing one means 0.3. The normative section on signed cards was not read, so its format is unverified.

## Key numbers
- Over 150 supporting organisations after one year (Linux Foundation press release title).
- 26,618 stars, Apache-2.0, last push 2026-11-20 (gh api, checked 2026-11-21).

## What Engram borrows
An identity mapping, not code. A verified agent card is the right source for a principal `agent:<name>` once MP-46 provides verified actors. The card says who the agent is, never what it may read, so memberships and grants stay in the plane (the MP-46 rule: claims never widen grants). No dependency now.

## What Engram does differently
A2A moves tasks and messages between agents. Engram governs what an agent may remember and recall, and is not a transport.

## Risk to our claims
None to H1 to H5. The risk is scope creep: an A2A adapter is a product feature with no hypothesis behind it.
