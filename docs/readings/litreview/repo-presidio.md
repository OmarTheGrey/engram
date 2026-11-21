---
id: repo-presidio
title: "Microsoft Presidio, and JavaScript PII options"
authors: Microsoft
venue: open-source repository
year: 2026
tier: new
topics: [pii, redaction, recognizers]
engram: [twin, govern, plane]
code: https://github.com/microsoft/presidio
sources_read: [gh api repository metadata 2026-11-21, npm view]
---

## Claim
PII detection splits into pattern recognizers with checksums and context words, and NER; the first is portable and deterministic, the second needs a model.

## Method
Metadata only. The call listing Presidio's predefined recognizers timed out, so recognizer names below are from memory and each must be checked against its source file before a port.

## Key numbers
- Presidio: MIT, 11,992 stars, last push 2026-11-19, Python.
- `redact-pii` on npm: 3.4.0, MIT, last modified 2024-11-19. Stale.
- compromise (NLP in JavaScript): MIT, 12,176 stars, last push 2026-11-19.

## What Engram borrows
Pattern recognizers with validation: email, phone, credit card by Luhn, IBAN by mod 97, IP address, US SSN shape, each with a score and context words. Presidio is the design reference.

## What Engram does differently
Detection feeds policy: a PII class per scope level with action deny, mask or allow, logged as an event. Person scope may keep a person's own PII; shared scope may not.

## Risk to our claims
Regex PII has low recall on names and addresses; claim only the pattern classes.

## Open question
Is person scope where PII is expected, so only promotion needs the gate?

## Notes
Names need NER. A Presidio analyzer would be a boundary service in Python, not core.
