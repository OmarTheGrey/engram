---
id: repo-cyclonedx-ml-bom
title: "CycloneDX specification, ML-BOM and the JavaScript library"
authors: CycloneDX / OWASP community
venue: ECMA-424 standard, spec repository
year: 2026
tier: new
topics: [provenance, governance, store]
engram: [govern, plane]
code: https://github.com/CycloneDX/specification ; https://github.com/CycloneDX/cyclonedx-javascript-library
sources_read: [https://cyclonedx.org/docs/1.6/json/, https://cyclonedx.org/use-cases/ai-models-and-model-cards/, https://github.com/CycloneDX/specification, https://github.com/CycloneDX/cyclonedx-javascript-library]
---

## Claim
CycloneDX represents AI components: a component of type machine-learning-model carries a modelCard, datasets are referenced as data components, and the whole is a signable JSON document, so an AI-BOM is an ordinary BOM.

## Method
Documentation (via search results) and repository metadata read, not the schema file itself. Repository checks via the GitHub API: specification is Apache-2.0, about 585 stars, pushed 2026-11-21, latest release tag 1.7.2 (2026-09-17). The JavaScript library is Apache-2.0, TypeScript, about 28 stars, pushed 2026-11-14.

## Key numbers
Stars and dates above are as returned by the API on 2026-11-21. No benchmark numbers.

## What Engram borrows
Emit a CycloneDX 1.7 JSON AI-BOM per deployment (AB-CMP-4): models as machine-learning-model components, stores and adapters as application or library components, the policy file and schema version as properties. Validate against the published bom-1.7 JSON schema in a test; the library is optional.

## What Engram does differently
Engram describes a running control plane and its evidence, not a model's training lineage; modelCard fields we cannot know (training data) are left absent rather than invented.

## Risk to our claims
Secondary sources disagree on 1.7's release month and edition number; cite the spec repository tag, not blogs.

## Open question
Is the pure-JSON route (schema validation only, no library) enough, avoiding a dependency row?

## Notes
Whether the 1.7 modelCard changed from 1.6 was not verified.
