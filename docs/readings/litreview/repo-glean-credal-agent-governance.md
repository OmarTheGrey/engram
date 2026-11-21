---
id: repo-glean-credal-agent-governance
title: Glean and Credal agent governance feature sets
authors: Glean; Credal (vendor pages)
venue: glean.com/security and credal.ai, read 2026-11-21
year: 2026
tier: new
topics: [governance, competitor, audit, provenance]
engram: [govern, plane]
code: none found
sources_read: [https://www.glean.com/security, https://www.credal.ai]
---

## Claim
Enterprise agent platforms sell source-permission enforcement on every read and write, a streamed audit trail, pre-execution checks on write actions, and human approval for sensitive actions. Glean lists security scans of memory as coming soon; Credal does not mention memory.

## Method
Two vendor marketing pages read. Glean: permission checks on each read and write, SIEM streaming, write-action checks against user intent and authority, SOC 2 Type II, ISO 42001, ISO 27001, HIPAA, GDPR, TX-RAMP L2. Credal: permissions synced from sources, per-team tool scoping, enforced parameters, approvals with an approver record, consolidated audit log, VPC option, SOC 2, GDPR and CCPA labels.

## Key numbers
none independently verified; Credal's accuracy and cost figures are marketing claims.

## What Engram borrows
Approval records on sensitive writes (extend promotion review, ADR 0026), SIEM streaming of events (AB-CMPT-3), enforced parameters as policy constraints on writes.

## What Engram does differently
Engram enforces at the memory boundary with a replayable log and explain, over any store. These products govern tool and data access around the agent.

## Risk to our claims
Glean says memory scans are coming; the empty memory-governance niche may close within a product cycle.

## Open question
Which of Glean's write-action checks reduce to our write gate, and which need intent judgement that requires a model?

## Notes
Both are vendor claims, not independently tested.
