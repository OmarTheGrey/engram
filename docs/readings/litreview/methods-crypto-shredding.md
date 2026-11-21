---
id: methods-crypto-shredding
title: Crypto-shredding for erasure from append-only logs (practitioner pattern)
authors: various practitioner sources
venue: blogs and library docs, 2025 to 2026
year: 2026
tier: new
topics: [twin, methods, governance]
engram: [twin, plane]
code: https://github.com/everest-engineering/axon-crypto-shredding-extension
sources_read: [web search result summaries of dev.to, conduktor.io and the Axon extension page; no page opened in full]
---

## Claim
Encrypt personal data under a per-subject key and erase by destroying the key, leaving the append-only log intact.

## Method
Key hierarchy: a KEK wraps per-subject or per-event DEKs held outside the event store; an event with two subjects can use two keys; keys can be derived from a master key and subject id to cut KMS cost. An erasure record notes the subject and the key destruction without PII.

## Key numbers
none stated in the sources read.

## What Engram borrows
Replaces redaction-by-rewrite in ADR 0010 with key destruction, which makes the log truly append-only and the erasure checkable: every ciphertext for the person fails to open.

## What Engram does differently
Engram also holds plaintext in store adapters (files, Mem0, Letta); shredding covers the log and encrypted-at-rest stores only.

## Risk to our claims
Sources are vendor and practitioner posts; none gave a regulator position on whether key destruction satisfies GDPR Article 17. Needs legal review. Copies and derived data are out of reach.

## Open question
Does a content hash left in the log let a holder of the plaintext confirm the item existed?

## Notes
Evidence quality is low; treat as a pattern, not a result.
