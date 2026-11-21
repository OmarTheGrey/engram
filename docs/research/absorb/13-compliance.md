# 13-compliance: compliance and enterprise readiness (AB-CMP)

## Executive summary

Engram already holds most raw evidence a regulator or auditor asks of a memory layer: every decision is an event with actor, scope, op, decision, reason and policy_id; reads are explained; retention retires by event; person-scope erasure redacts the log (ADR 0010, card E9.7). What is missing is the evidence layer on top. The log is not tamper-evident (a search of packages/core/src found no hash chain or signature code), there is no exportable, signed report, no records-of-processing output, no per-regulation retention templates, and no inventory (AI-BOM) of a deployment. The best-fitting standards are all open and permissive: DSSE/in-toto envelopes, CycloneDX 1.7 (Apache-2.0), OSCAL (CC0), and RFC 9943 (SCITT) as the design reference. The one real design conflict is that GDPR erasure (Art. 17) rewrites the log while tamper-evidence wants immutability; the answer is a hash chain over a content-free skeleton with salted content commitments, so erasure destroys the content and its commitment key but leaves the chain verifiable. That reconciliation is a thesis-grade contribution. All open-source compliance platforms found are AGPL or GPL (ideas only), so the work is mostly Engram-authored on top of standards.

## Regulatory facts used (secondary sources; primary texts not read)

- EU AI Act Art. 12 requires high-risk systems to support automatic event recording over their lifetime. Retention floor of six months sits in Art. 19(1) (providers) and Art. 26(6) (deployers), unless other law, notably data protection, says otherwise. Commentary only; Official Journal text not checked.
- Digital Omnibus on AI: Council final approval 29 June 2026, reported as Regulation (EU) 2026/1744 in force 27 July 2026; Annex III high-risk applies from 2 December 2027, Annex I from 2 August 2028; most Art. 50 transparency duties still from 2 August 2026 (Orrick, Gibson Dunn, Jones Walker commentary). Sources differ on minor dates.
- EDPB Opinion 28/2024 (Dec 2024): whether a model holds personal data is case by case; says nothing specific about agent memory. EDPB Guidelines 02/2025 on blockchain (final July 2026): technical impossibility does not excuse erasure; advises against putting clear, encrypted or hashed personal data on an immutable ledger; accepts making data unidentifiable (deleting off-chain data, destroying keys). Directly relevant to our chain design.
- ISO/IEC 42001 control A.6.2.8 (AI system recording of event logs): commentary says logging must be on at least while the system is in use, with tool-call level logging suggested by one vendor (not a requirement).
- NIST AI RMF 1.0 is under revision (NIST statement, per search); AI 600-1 Generative AI Profile final July 2024. No official OSCAL AI-RMF or 42001 catalogue found.
- RFC 9943 (SCITT architecture), June 2026, Proposed Standard.

## Landscape

| Name | URL | Licence | Stars, last activity (API, 2026-11-21) | Language | Gives us | Absorb mode |
|---|---|---|---|---|---|---|
| CycloneDX specification (1.7.2) | github.com/CycloneDX/specification | Apache-2.0 | ~585, 2026-11-21 | JSON schema/XSLT | AI-BOM format, machine-learning-model + modelCard | depend (schema file as test fixture) |
| cyclonedx-javascript-library | github.com/CycloneDX/cyclonedx-javascript-library | Apache-2.0 | ~28, 2026-11-14 | TypeScript | BOM builders, serializers | optional depend |
| cdxgen | github.com/cyclonedx/cdxgen | Apache-2.0 | ~1,127, 2026-11-20 | JavaScript | SBOM of the repo itself | tool, not absorbed |
| usnistgov/OSCAL | github.com/usnistgov/OSCAL | CC0 / public domain | ~972, 2026-11-16 | XSLT, schemas | assessment-results, component-definition models | port (write JSON to schema) |
| GSA/oscal-js | github.com/GSA/oscal-js | none set | ~14, 2025-11-18 | TypeScript | OSCAL helpers | not absorbable (no licence) |
| secure-systems-lab/dsse | github.com/secure-systems-lab/dsse | Apache-2.0 | ~116, 2026-11-20 | spec | signed envelope | port (30 lines on node:crypto) |
| in-toto/attestation | github.com/in-toto/attestation | Apache-2.0 (LICENSE file; API says NOASSERTION) | ~394, 2026-11-16 | spec | Statement/predicate layout | port the layout only |
| RFC 9943 SCITT | datatracker.ietf.org/doc/rfc9943 | IETF | n/a | spec | signed statements, receipts | ideas, shaped checkpoints |
| transparency-dev/tessera | github.com/transparency-dev/tessera | Apache-2.0 | ~262, 2026-11-19 | Go | tile-based Merkle log | ideas only (Go) |
| sigstore/model-transparency | github.com/sigstore/model-transparency | Apache-2.0 | ~250, 2026-11-09 | Python | model signing | ideas (for model hashes) |
| open-telemetry/semantic-conventions | github.com/open-telemetry/semantic-conventions | Apache-2.0 | ~690, 2026-11-21 | YAML | field names for GenAI traces | ideas for export field names (GenAI conventions not verified) |
| CIRCL/compliance | github.com/CIRCL/compliance | AGPL-3.0 (verified) | ~66, 2024-03-15 | JSON Schema | Art. 30 record schema (draft-07) | ideas only (AGPL); field names as a reference, no copying |
| trycompai/comp | github.com/trycompai/comp | AGPL-3.0 | ~2,105, 2026-11-18 | TypeScript | SOC 2 / ISO platform | not absorbable |
| yild/gdprropa | github.com/yild/gdprropa | GPL-3.0 | ~5, 2025-07-15 | PHP | RoPA registry | not absorbable |
| opencontrol/compliance-masonry | github.com/opencontrol/compliance-masonry | NOASSERTION | ~387, 2026-02-16 | Go | control-as-data idea | ideas only |

Papers read (abstract level only): Agentic Process Evidence (2610.40071), AI Act verification mapping (2512.13907), AIBoMGen (2601.05703). Notes written for each, plus three repo notes.

## PR plans

### AB-CMP-1: Signed audit report of every decision for a period
- goal: `engram audit export --scope|--all --from --to --key <file>` writes one JSON statement of every event in the window (id, seq, ts, actor, scope, op, decision, reason, policy_id, item_ids, never content, provenance refs or evidence hashes; the reason of an erase or sweep event carries unsalted content hashes under LEFT_CONTENT_CLAUSE in packages/core/src/events.ts, so the report strips that clause and the hashes before export), the policy hash and schema version in force, counts per decision and rule, and the invariants' result over the window, in a DSSE envelope with an Engram predicate type, signed Ed25519 via node:crypto. `engram audit verify` checks it offline.
- absorbs: DSSE envelope layout, in-toto Statement layout, APE idea (2610.40071).
- files: packages/core/src/audit/report.ts (pure: builds the statement from events), packages/core/src/audit/envelope.ts, packages/cli/src/audit.ts, packages/server route `/audit/report` (routes.ts, then `make api` regenerates sdk and openapi), tests under packages/core/test/unit/audit/ (the real test layout is test/unit, test/property, test/replay, not test/audit), docs/log entry, docs/deps.md (no new dep; core already imports node:crypto in content-hash.ts). Reuse oracle.ts and dogfood.ts for the invariants-over-a-window part rather than a second replay. The key file is read in packages/cli, core receives a key object (rule 1, no I/O in core).
- effort: M. depends on: none (reads existing log).
- value: product, the artefact an auditor or DPO takes away; thesis, makes "every decision is logged with a reason" checkable by a third party.
- risks: report must contain no memory content or the erased person's data (rule 12, GDPR); key management is the operator's, say so; no licence risk.
- acceptance: `make test-one T=packages/core/test/unit/audit/report.test.ts` (golden report from fixtures/log, verify passes, one flipped byte fails, a window with an erasure contains no erased content).

### AB-CMP-2: Tamper-evident log with erasure-compatible hash chain
- goal: add `chain_hash` per event = H(prev_chain_hash || canonical skeleton), where the skeleton excludes everything offboard.ts redacts or that carries erased-content traces (event.item with content, provenance ref and hash; the lint-event reason; the erase and sweep reason with its merging content hashes) and holds only a salted commitment of them; add periodic signed checkpoints (tree head: seq, root, ts) and `engram audit verify-chain`. Erasure destroys the content, ref and the per-person salt; the chain still verifies. Optional: RFC 3161 or git-tag anchoring of checkpoints.
- absorbs: RFC 9943 / Tessera ideas (checkpoints, consistency), EDPB 02/2025 key-destruction reasoning.
- files: keep the chain out of the MemoryEvent body (a side table `event_chain(seq, chain_hash, salt_id)` added in packages/core/src/db/migrate.ts for both SQLite and Postgres, ADR 0024), so schema.ts and `make api` need not change; if the lead prefers a `chain_hash` field on MemoryEvent, that is a rule 5 PR of its own and the chain logic goes in a second PR. Append hook in packages/core/src/events.ts (inside the existing append transaction), the salted commitment hook in packages/core/src/plane/offboard.ts (it destroys the salt), a backfill checkpoint for existing logs, `make test-invariants` new invariant (chain verifies after any sequence incl. erasure; adds an eighth to packages/core/test/property/invariants.test.ts, so the "seven invariants" wording in AGENTS.md and the Makefile changes in the same PR), ADR (new, amends 0003 and 0010). Note ADR 0010 deliberately keeps unsalted merging hashes of erased content in erase-event reasons for left-in-store records; the skeleton must not commit to them in the clear, and the chain does not make that existing trace worse.
- effort: L. depends on: none, but should land before AB-CMP-1 is claimed "tamper-evident".
- value: product, evidence integrity for Art. 12 and SOC 2 style audits; thesis, the erasure versus immutability reconciliation, with a property test as evidence.
- risks: the existing rewrite (0010) changes bytes of earlier events, so skeleton design must be done before any chain ships; a salted commitment of a short note is still guessable only with the salt, so salt must be per item and erased with it; checkpoints signed with the deployment's own key prove integrity, not independence (state this).
- acceptance: `make test-invariants` including the new chain invariant over 500 seeded random sequences with an erasure.

### AB-CMP-3: OSCAL component-definition and assessment-results export
- goal: `engram audit oscal` emits (a) an OSCAL component-definition stating which Engram mechanisms implement which controls in Engram's own small catalogue, and (b) assessment-results whose findings are the invariants, lints and conformance outcomes for a period.
- absorbs: OSCAL schemas (CC0).
- files: packages/core/src/audit/oscal.ts, packages/core/src/audit/catalogue.ts (the control map, one table), schema fixtures, tests; schema JSON vendored under fixtures with its licence line.
- effort: M. depends on: AB-CMP-5 (its crosswalk is the source of the control map) and AB-CMP-1 only if findings reuse the report builder.
- note: ajv 8.20.0 is already a core dev dependency (docs/deps.md), so schema validation in the test needs no new dep; OSCAL's JSON schema is draft-07, which ajv's default class handles. Test path is packages/core/test/unit/audit/oscal.test.ts. Lowest priority of the seven: the thesis value is already delivered by AB-CMP-5.
- value: product, ingestible by GRC tools that read OSCAL; thesis, the crosswalk table in machine form.
- risks: no official AI catalogue exists, so ids are ours and must be labelled so; verbose output; schema validation needs a JSON-Schema validator already in the repo (check) or a new dep row.
- acceptance: `make test-one T=packages/core/test/audit/oscal.test.ts` (output validates against OSCAL 1.2.x JSON schema).

### AB-CMP-4: AI-BOM for an Engram deployment
- goal: `engram doctor --aibom` or `engram audit aibom` writes CycloneDX 1.7 JSON: models seen in the usage ledger or named in config (machine-learning-model, provider/model id, no invented modelCard fields), stores and adapters with versions, pi packages at pinned versions (from docs/deps.md), policy hash, schema version, benchmark pins and fixture hashes as properties; wrapped optionally in the AB-CMP-1 envelope.
- absorbs: CycloneDX spec, AIBoMGen pattern (2601.05703).
- files: packages/core/src/audit/aibom.ts (pure), packages/cli, test validating against the bom-1.7 JSON schema fixture, docs/deps.md only if cyclonedx-javascript-library is used (optional, the pure-JSON route needs no dependency).
- effort: S to M. depends on: none. 
- value: product, supply-chain and procurement artefact; thesis, shows the reproducibility pins (PINS.md, deps.md) as a standards-shaped inventory.
- placement fix: the usage ledger is written by packages/runner (journal.ts, usage.jsonl) and packages/model, which core cannot import, so the CLI or runner reads it and passes plain data to the pure builder in core. The bom-1.7 schema references spdx and jsf schemas, so the test must vendor those too. Test path packages/core/test/unit/audit/aibom.test.ts.
- risks: thin without training data (honest); model list from config can differ from observed use, so emit both with a flag.
- acceptance: `make test-one T=packages/core/test/audit/aibom.test.ts`.

### AB-CMP-5: Obligation crosswalk and claim-to-test traceability
- goal: a data file docs/compliance/crosswalk.json mapping each Engram governance claim to (obligation, article or control, what Engram evidences, what it does not, test or script that produces the evidence); a script generates the thesis table and fails if a mapped test is missing. Covers AI Act Art. 10, 12, 14, 19, 26, 50; GDPR Art. 5(1)(c) and (e), 17, 20, 25, 30, 35; ISO 42001 A.6.2.8; NIST AI RMF (Govern/Map/Measure/Manage subcategories as ids, after checking the text); SOC 2 CC6, CC7 (criteria text to be verified).
- absorbs: method of 2512.13907.
- files: docs/compliance/crosswalk.json, research/scripts/compliance_crosswalk.py, research/configs/, research/results/ row in MANIFEST.md (rule 9), thesis draft section.
- effort: M. depends on: none. 
- value: thesis, "governance claims mapped to real obligations" with a regenerating script (rule 9); product, sales and DPO material.
- risks: legal misstatement. Every row cites the article from the primary text, and the doc states Engram supplies evidence and does not confer compliance.
- acceptance: `uv run python research/scripts/compliance_crosswalk.py --check` and `make test-repro`.

### AB-CMP-6: Retention-policy templates per regulation
- goal: shipped policy files (packages/core or fixtures/policies/templates): `ai-act-high-risk-deployer` (decision log kept at least six months, memory content per purpose), `gdpr-minimal` (short ttl on person-scope episodic, erasure on offboarding), `soc2-evidence` (log kept per organisation period, content short ttl), `eu-sovereign-default`. Each template is a normal policy validated by the existing loader, carries a comment block naming the obligation, and `engram simulate` can compare a template against the current policy on a recorded workload. A lint flags a policy whose log retention is below the template's floor. Note retention today governs memory items (ADR 0025), not the event log, so log retention needs a stated rule: the log keeps skeleton events, content is erased at ttl.
- absorbs: none (Engram-authored); informed by Art. 19 and GDPR 5(1)(e).
- fix: fixtures/policies does not exist (fixtures/profiles holds workload profiles, a different thing); put templates in a new fixtures/policy-templates or docs/compliance/templates. The log floor lint is vacuous today because retention never touches the log (ADR 0010, 0025); drop it, or add a log-retention field in a separate schema PR after AB-CMP-2. Without it the plan is templates plus a simulate comparison, so the dependence on AB-CMP-2 is removed. Test path packages/core/test/unit/policy/templates.test.ts.
- files: packages/core/src/policy/load.ts (only if a new field is needed, then its own schema PR), packages/cli, docs.
- effort: M. depends on: AB-CMP-2 for log-level retention semantics.
- value: product, one-flag compliance starting points; thesis, simulator comparison table shows the utility cost of each regime (links H2 tax).
- risks: templates read as legal advice; label as starting points. Six-month figure needs the primary text check.
- acceptance: `make test-one T=packages/core/test/policy/templates.test.ts` (every template loads, simulates on the fixture workload, and trips the floor lint when weakened).

### AB-CMP-7: Records-of-processing (Art. 30) and DSAR bundle generator
- goal: `engram audit ropa` generates an Art. 30 record per scope from the policy and log: purposes (from scope and class), categories of data subjects and data (person, role), recipients (grants), transfers (store location from adapter, operator-supplied), retention periods (from retention rules), security measures (the plane's controls, listed). `engram export --subject person:<id>` produces an Art. 15 and 20 bundle (the person's own items in JSON, with provenance, machine-readable, no other person's data). Also a DPIA screening checklist output (Art. 35) drawn from policy facts.
- absorbs: Art. 30 field list only. CIRCL/compliance is AGPL-3.0 (ideas only, no copying of its schema); gdpr-ropa-automation was never identified or licence-checked and is dropped as a source.
- files: packages/core/src/audit/ropa.ts, packages/core/src/audit/subject-export.ts, packages/cli, packages/server routes, tests, docs.
- effort: M. depends on: AB-CMP-6 helpful, not required.
- value: product, the paperwork a controller must hold; thesis, Twin's consent and offboarding mapped to Art. 17 and 20 with a test that an export contains only the subject's grants-allowed items.
- fix: the subject export must call Plane.read as the subject (rule 2), not the db directly; test paths are packages/core/test/unit/audit/. Overlaps in part with offboard's deletion report and dogfood.ts aggregates, which should be reused for the retention and recipient facts.
- risks: Engram is a processor tool, the controller supplies purposes and legal basis, so those fields are operator input, not inferred; subject export must run under the read matrix and never bypass it (rule 2).
- acceptance: `make test-one T=packages/core/test/audit/ropa.test.ts packages/core/test/audit/subject-export.test.ts`.

## Recommended order

1. AB-CMP-2 (tamper-evident chain that survives erasure). It is the one decision that changes stored bytes, so it must come before anything claims integrity, and it is the strongest thesis contribution (immutability versus Art. 17, grounded in EDPB 02/2025's key-destruction position).
2. AB-CMP-1 (signed audit export). Highest visible product value, small, standards-shaped, and it depends only on the skeleton fields chosen in AB-CMP-2.
3. AB-CMP-5 (crosswalk with a regenerating script). Cheap, no code risk, and it delivers the thesis requirement of governance claims mapped to real obligations; it also decides which of AB-CMP-3, 4, 6, 7 are worth building.

## Unverified

- Article 12, 19 and 26(6) wording, and the AI Act application dates, rest on law-firm and blog commentary, not the Official Journal. The Omnibus regulation number 2026/1744 comes from one source.
- ISO/IEC 42001 control text (A.6.2.8) is from commentary, not the standard.
- SOC 2 criteria and NIST AI RMF subcategory ids were not researched at source level here.
- Licence and stars of CIRCL/compliance and the in-toto attestation files were not confirmed; GitHub API timed out for CIRCL.
- OpenTelemetry GenAI semantic-convention field names were not read.
- Whether CycloneDX 1.7 changed modelCard against 1.6 was not checked; the schema files were not read.
- The three papers were read at abstract level only.

## Verification (2026-11-21)

Checked:
- All 14 repositories against `gh api`: licence, stars, last push. Matches the report except CIRCL/compliance (AGPL-3.0, 66 stars, last push 2024-03-15; the report had "licence not confirmed"), in-toto/attestation (API says NOASSERTION, its LICENSE file is Apache-2.0), yild/gdprropa (5 stars, 2025-07-15). usnistgov/OSCAL is NOASSERTION by API and CC0 1.0 and public domain by its LICENSE.md, confirmed. CycloneDX 1.7.2 (2026-09-17) and OSCAL v1.2.3 (2026-08-07) releases confirmed. GSA/oscal-js has no licence, confirmed.
- arXiv 2610.40071 (Agentic process evidence), 2512.13907 (Assessing High-Risk AI Systems under the EU AI Act), 2601.05703 (AIBoMGen) all resolve to the claimed titles. RFC 9943 exists, June 2026, title "An Architecture for Trustworthy and Transparent Digital Supply Chains".
- Repo facts: no hash chain, signature or audit code exists in packages/core/src (confirmed); the log is append-only apart from offboard.ts redaction (ADR 0010); node:crypto is already used in core; ajv is a core dev dependency; fixtures/policies and packages/core/test/audit do not exist.
- The seven litreview notes in .claude/worktrees/research: frontmatter ids, titles, code URLs checked; the in-toto licence line in repo-scitt-dsse-attestation.md corrected; no em dashes found in the notes or the report.

Corrected:
- CIRCL/compliance now marked AGPL-3.0, ideas only (was an unconfirmed absorb source); gdpr-ropa-automation dropped as an unidentified source.
- AB-CMP-1: erase and sweep event reasons carry unsalted content hashes (events.ts LEFT_CONTENT_CLAUSE), so "hashes" in the export is wrong; the clause is stripped. Test path fixed to test/unit/audit.
- AB-CMP-2: the redaction also rewrites lint-event reasons and erase reasons, so the skeleton must exclude those too; the chain belongs in a side table, avoiding a rule 5 schema PR (the original file list put schema, migration, events and invariants in one PR, which rule 5 forbids); a new invariant makes eight, which changes AGENTS.md and the Makefile wording.
- AB-CMP-3: dependency changed to AB-CMP-5; ajv already available.
- AB-CMP-4: the usage ledger is in runner/model, so core's builder takes plain data.
- AB-CMP-6: the log-retention floor lint is vacuous (retention never touches the log); templates dir fixed.
- AB-CMP-7: must go through Plane.read; AGPL source flagged.

Refuted: none of the repo or paper claims. Not refuted but still unverified: the regulatory dates and article numbers (secondary sources), SOC 2 and NIST subcategory ids.

Verdicts: AB-CMP-1 keep-with-fix, AB-CMP-2 keep-with-fix, AB-CMP-3 keep-with-fix (lowest priority), AB-CMP-4 keep-with-fix, AB-CMP-5 keep, AB-CMP-6 keep-with-fix, AB-CMP-7 keep-with-fix.
