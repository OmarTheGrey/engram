---
id: repo-policy-engines-compared
title: Policy engines compared for Engram (OPA, OpenFGA, SpiceDB, Casbin, Oso, Permify, Cerbos, CEL)
authors: various open source projects
venue: open source, checked 2026-11-21
year: 2026
tier: new
topics: [governance, policy, survey]
engram: [govern, plane]
code: https://github.com/open-policy-agent/opa
sources_read: [GitHub API metadata for each repository, npm registry metadata]
---

## Claim
Only Cedar pairs a small decidable language with an official formal analyzer. The others are servers (Go, no in-process TypeScript path) or evaluators with no analysis story.

## Method
Licence, stars, push date and language from `gh api`; npm versions from the registry. Docs were not read beyond READMEs, so capabilities beyond the numbers below are from general knowledge and marked so.

## Key numbers
- OPA: Apache-2.0, 12,503 stars, Go, pushed 2026-11-21. `@open-policy-agent/opa-wasm` 1.10.0, Apache-2.0, last modified 2024-11-08.
- OpenFGA: Apache-2.0, 6,171, Go. SpiceDB: Apache-2.0, 7,233, Go. `openfga/language` (DSL parser): Apache-2.0, 35 stars.
- Casbin: apache/casbin Apache-2.0, 20,509; node-casbin 2,921 stars, TypeScript, npm 5.51.1.
- Oso: Apache-2.0, 3,480 stars, archived, last push 2026-10-22.
- Permify: AGPL-3.0, 5,975 stars: not absorbable.
- Cerbos: Apache-2.0, 4,665, Go. `@marcbachmann/cel-js` 8.0.0, MIT, pushed 2026-11-05 (google/cel-js does not exist).

## What Engram borrows
Ideas only. Zanzibar tuples (item#reader@principal) match a grant list, and "expand" is the model for the who-can-see query (AB-POL-3). Rego's `opa test` and Cerbos test fixtures inform the policy test format (AB-POL-4). CEL is a candidate for a typed predicate in a later policy version, not now.

## What Engram does differently
The evaluator stays the typed one (ADR 0006). OPA and Casbin add a language and a build step without analysis; OpenFGA and SpiceDB add a server and a datastore, against the no-Docker and in-process rules.

## Risk to our claims
A reviewer may ask why not OPA. Answer: ADR 0006 alternative (c), and no official solver-backed analyzer.

## Open question
Is a Zanzibar-style expand worth citing as related work for the who-can-see query?

## Notes
Zanzibar and Rego semantics were not re-read here.
