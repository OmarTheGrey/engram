---
id: repo-oscal
title: "NIST OSCAL: machine-readable controls and assessment results"
authors: NIST
venue: usnistgov/OSCAL, release v1.2.3 (2026-08-07)
year: 2026
tier: new
topics: [governance, evaluation, methods]
engram: [govern, plane]
code: https://github.com/usnistgov/OSCAL
sources_read: [https://github.com/usnistgov/OSCAL, https://github.com/usnistgov/OSCAL/blob/main/LICENSE.md]
---

## Claim
OSCAL gives JSON, YAML and XML models for catalogs, profiles, component definitions, assessment plans and assessment results, so control evidence can be exchanged by machine.

## Method
Repository and licence read. The repository is CC0 1.0 and US public domain per its LICENSE.md (the API shows NOASSERTION), about 972 stars, pushed 2026-11-16. GSA/oscal-js (TypeScript) has no licence set and was last pushed 2025-11-18, so it is not absorbable.

## Key numbers
None. No official OSCAL catalog for the NIST AI RMF or ISO 42001 was found; a community catalog PR (usnistgov/oscal-content#338) is claimed by a vendor page and was not verified.

## What Engram borrows
An OSCAL component-definition (what Engram implements, per control) and assessment-results (findings from the invariants and lints) export (AB-CMP-3), written as plain JSON against the published schema.

## What Engram does differently
OSCAL has no AI-RMF catalog we can rely on, so Engram defines its own small control catalogue (AI Act Art. 10, 12, 14, 19, 26; GDPR 17, 20, 30; ISO 42001 A.6.2.8) and says so.

## Risk to our claims
Control ids in a self-made catalogue can drift from the real texts. Cite article numbers only from the primary texts and mark the catalogue as ours.

## Open question
Is OSCAL worth its verbosity for a thesis, versus a flat JSON crosswalk?

## Notes
The open-source compliance platform found, trycompai/comp, is AGPL-3.0 (about 2,105 stars, TypeScript): ideas only.
