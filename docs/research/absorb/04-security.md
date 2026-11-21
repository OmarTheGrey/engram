# 04-security: memory safety, poisoning, PII, provenance signing

## Executive summary

Engram's gate decides on origin (provenance kind, scope, grants, source isolation) and never reads content for hazards. That is right for poisoning (Origin-Bound Authority, 2606.24322) but leaves four holes a reviewer will name: secrets and PII are stored and served verbatim, the event log is append-only by convention only (a SQLite file anyone can edit), there is no classifier for injection-bearing content, and no red-team harness measures the gate against a corpus. Each has a mature open-source answer that fits the constraints. Secrets: port gitleaks (MIT, 222 rules in one TOML) and detect-secrets (Apache-2.0) plugins into a deterministic content guard in `packages/core`. PII: port Presidio-style pattern recognizers with checksums. Tamper evidence: an RFC 6962 Merkle tree over events with Ed25519 signed checkpoints in the C2SP format, on `node:crypto`, no dependency; the one design trap is that offboarding redacts events in place, so the leaf must commit to a salted hash of the redactable fields. Injection: an Apache-2.0 DeBERTa classifier (ProtectAI) run in-process by transformers.js at the boundary and injected as a lint, since Meta's Prompt Guard 2 weights carry Llama terms. Red-team: a seeded, cassette-replayed harness organised by the MemForm interfaces, fed by Apache and MIT corpora. LLM Guard and Rebuff are archived; NeMo Guardrails and PyRIT are heavy Python frameworks, best used as ideas. All counts below were checked on 2026-11-21 unless marked.

## Landscape

| Name | URL | Licence | Stars, last push (verified) | Language | What it gives us | Mode |
|---|---|---|---|---|---|---|
| gitleaks | github.com/gitleaks/gitleaks | MIT | 31,230; 2026-10-28 | Go | `gitleaks.toml`: 222 rules with keywords, entropy, allowlists | port (generated table) |
| detect-secrets | github.com/Yelp/detect-secrets | Apache-2.0 | 4,682; 2026-04-02 | Python | 26 plugins incl. entropy, keyword, JWT, private key | port |
| secretlint | github.com/secretlint/secretlint | MIT | 1,503; 2026-11-21 | TypeScript | JS-native rule presets (npm 14.0.1) | ideas, optional depend |
| trufflehog | github.com/trufflesecurity/trufflehog | AGPL-3.0 | 29,559; 2026-11-20 | Go | verifiers for live secrets | NOT absorbable, ideas |
| Presidio | github.com/microsoft/presidio | MIT | 11,992; 2026-11-19 | Python | pattern recognizers, checksums, context words, anonymizer | port patterns |
| compromise / redact-pii | github.com/nlp-compromise/compromise ; npm redact-pii | MIT | 12,176; 2026-11-19 / redact-pii 3.4.0 last modified 2024-11-19 | JS | light NLP; stale redactor | ideas only |
| protectai deberta-v3-base-prompt-injection-v2 | huggingface.co/protectai/deberta-v3-base-prompt-injection-v2 | Apache-2.0 (model tag) | 397,882 downloads; modified 2026-07-09; ONNX tag | model | injection classifier runnable in transformers.js (Apache-2.0, 16,439 stars) | depend (boundary) |
| Llama Prompt Guard 2 / PurpleLlama | github.com/meta-llama/PurpleLlama | Llama community licence (model `license:other`); repo NOASSERTION | 4,486; 2026-11-20 | Python | classifier, LlamaFirewall scanner design | NOT absorbable, ideas |
| LLM Guard / Rebuff | github.com/protectai/llm-guard ; /rebuff | MIT / Apache-2.0 | 3,221 (archived, 2026-07-08); 1,533 (archived, 2024-08-07) | Python / TS | scanner catalogue; canary-token idea | ideas only |
| NeMo Guardrails | github.com/NVIDIA/NeMo-Guardrails | Apache-2.0 (LICENSE.md header; GitHub says NOASSERTION) | 7,538; 2026-11-19 | Python | rails taxonomy | ideas only |
| garak | github.com/NVIDIA/garak | Apache-2.0 | 10,122; 2026-11-18 | Python | probe and detector structure, report format | ideas, optional offline run |
| PyRIT | github.com/microsoft/PyRIT | MIT | 5,001; 2026-11-21 | Python | orchestrators, converters, scorers | ideas |
| Lakera gandalf_ignore_instructions, mosscap_prompt_injection; deepset/prompt-injections | huggingface.co/datasets | MIT; MIT; Apache-2.0 | 1K-10K rows; 100K-1M rows; under 1K rows | data | red-team and classifier evaluation corpora | depend on data (pinned, rule 8) |
| CaMeL, FIDES | github.com/google-research/camel-prompt-injection ; microsoft/fides | Apache-2.0 ; MIT | 425, 2025-06-20 ; 125, 2025-05-30 | Python | capability and label model | ideas |
| C2SP tlog-checkpoint, Tessera, Trillian, Rekor, sigstore-js | c2sp.org ; github.com/transparency-dev/tessera ; google/trillian ; sigstore/rekor ; sigstore/sigstore-js | Apache-2.0 for the repos; spec licence not stated on the page read | Tessera 262, Trillian 3,765, Rekor 1,237, sigstore-js 188; all pushed Nov 2026 | Go / TS | checkpoint format, consistency proofs | port the algorithm |

Methods read (abstract level, see notes in `docs/readings/litreview/`): CaMeL 2503.18813 (77 percent of AgentDojo tasks with provable security against 84 undefended), FIDES 2505.23643, A-MemGuard 2510.02373 (over 95 percent attack reduction, consensus plus lessons store), FARMA/SENTINEL 2607.05029 (reports consensus defences and A-MemGuard defeated), MemForm 2610.14431 (five formation interfaces), Spotlighting 2403.14720 (over 50 to under 2 percent), LlamaFirewall 2505.03574. Not absorbable but usable for ideas: none of the model-based defences is a gate substitute; 2607.05029 and Origin-Bound Authority both say content or consensus defences are launderable.

Not done: C2PA was not researched (it targets media assets, a poor fit for text events; in-toto's repository licence reads NOASSERTION and was not resolved). Sigstore keyless signing needs a network identity provider, unsuitable for an offline local log; a local Ed25519 key with optional cosigning is the fit.

## PR plans

### AB-SEC-1: Tamper-evident event log with Merkle tree and signed checkpoints
- **goal:** detect any edit, deletion, reordering or truncation of the events table, except the one sanctioned redaction.
- **absorbs:** RFC 6962 tree and the C2SP tlog-checkpoint format (algorithm, no code); Tessera and Rekor as design references.
- **design:** new migration adds `event_chain (seq, leaf_hash, tree_size)` and `checkpoints (size, root, signature, key_id, ts)`. `appendEvent` (`packages/core/src/events.ts`) computes the leaf in the same transaction. Leaf = H(0x00 || canonical skeleton of the event || commitment), where the commitment is H(per-item salt || redactable fields: item content, provenance ref and hash, lint reason tail). Offboarding (`plane/offboard.ts`, which does `UPDATE events SET body`) deletes the salt and rewrites the body; verification of a redacted event accepts the stored commitment as opaque, so the chain still verifies and the erased content cannot be brute-forced from the log. Checkpoints are signed Ed25519 notes (`node:crypto`), written every N events and on `engram checkpoint`; the key is a file under `<home>/.engram/`, never in the repo. Core does the hashing and verifying; signing is injected (`Signer`) so core holds no key I/O.
- **files:** `packages/core/src/events.ts`, new `packages/core/src/chain.ts`, `packages/core/src/db/migrate.ts`, `packages/core/src/plane/offboard.ts`, `packages/cli/src` (`engram verify`, `engram checkpoint`), `engram doctor`, tests under `packages/core/test/unit` and `property`.
- **effort:** L. **depends on:** none (new table, no schema_version bump, so rule 5 does not bite; confirm with the lead). A salted commitment changes what an old log's events can prove, so existing logs get a "chain starts at seq N" checkpoint.
- **value:** product, an auditor can check the log offline; thesis, closes the VMG "rollbackability and provenance" rubric (2604.16548) and a reviewer's "who audits the auditor" question. Adds a new invariant: for every sequence of operations the chain verifies and an injected edit is caught.
- **risks:** erasure semantics (the central trap above); multi-process writers (the chain head must be read inside the log's lock; ADR 0007 E2.6 protocol); Postgres parity; key custody. Licence: none, algorithm only.
- **acceptance:** `make test-invariants` with a new property (random ops plus one random byte edit is always detected; offboarding keeps the chain valid) and `make engram ARGS="verify --db <log>"` exits 0 on a clean log, 1 on a tampered fixture.

### AB-SEC-2: Secret and PII guard at the write gate
- **goal:** a deterministic content check in the gate that denies or masks secrets and PII patterns, with the rule id and masked excerpt in the event reason.
- **absorbs:** gitleaks `config/gitleaks.toml` (MIT) and detect-secrets plugins (Apache-2.0), plus Presidio's pattern-recognizer design (MIT). A generator script converts the TOML into `packages/core/src/guard/secret-rules.ts` (id, regex, keywords, entropy, allowlist) at a pinned upstream commit, with notices in `docs/deps.md`. Hand-ported PII table: email, phone, credit card (Luhn), IBAN (mod 97), IP, US SSN shape.
- **design:** policy gains a typed `content_guards` block per scope level: `{ class: secret | pii, action: deny | mask | allow, min_severity }`. Evaluation is a pure function in `policy/evaluate.ts` run after the confidence floor. `mask` writes the masked content (the event records original hash only), so a secret never enters the log or store. Also applied in adoption and to `Plane.promote` (a person-scope secret must not move to shared scope even when allowed in person scope). The MCP surface and pi tool results get the same check on read via the stored form, so nothing is retrofitted.
- **files:** `packages/core/src/policy/evaluate.ts`, `policy/load.ts`, new `packages/core/src/guard/`, policy presets, `fixtures/faults/` (flag and near-miss per class, as lint convention), `packages/core/test/unit/guard/`.
- **effort:** M. **depends on:** a policy-schema decision (new ADR; rule 5 is about item schema, but policy files are versioned too).
- **value:** product, the first thing an enterprise reviewer asks; thesis, a new H3-style table: deterministic class coverage and false positive rate on near-miss fixtures. Twin needs it for person-to-role promotion.
- **risks:** Go-flavoured regexes may not compile as JS RegExp (publish the ported fraction); catastrophic backtracking (run every rule in a time-boxed test, reject nested quantifiers); false positives on legitimate stored text; entropy rules are noisy. Licence: MIT and Apache-2.0, notices kept.
- **acceptance:** `make test-one T=packages/core/test/unit/guard/secrets.test.ts`, with every ported rule having a positive and a negative sample and the generator output byte-stable (`make api-check` style).

### AB-SEC-3: Injected injection-classifier lint
- **goal:** an `injection-suspect` lint that scores stored content for embedded instructions using a classifier supplied at the boundary.
- **absorbs:** protectai/deberta-v3-base-prompt-injection-v2 (Apache-2.0) via transformers.js (Apache-2.0, pinned exact; see `repo-transformers-js.md` from another agent); LlamaFirewall's scanner shape; deepset and Lakera data for evaluation.
- **design:** core defines `ScoreCall = (text) => Promise<{score, label}>`, injected like `ModelCall`, with no import of the runtime. The adapter lives in `packages/runner` or `packages/model` (ADR 0033), runs the ONNX model in process (no Docker, no network after the weights are fetched at a pinned hash), and is cached by text hash (rules 6 and 7; the classifier is deterministic, seed recorded as none). The lint joins `MODEL_LINT_IDS` (`packages/core/src/lint.ts`), reports in `LintReport.judgments`, appends a lint event on a flag above a policy threshold. Scoped to `model`, `external`, `tool` and `compaction` sources first. Findings optionally quarantine rather than retire (see AB-SEC-6).
- **files:** `packages/core/src/lint.ts`, `lint/model.ts` (or new `lint/classifier.ts`), `packages/runner` adapter, `docs/deps.md`, `fixtures/lint`, cassettes.
- **effort:** M. **depends on:** the L3 model-lint tier (merged per ADR 0008 amendment), AB-SEC-4 for evaluation.
- **value:** product, the demo of "an injected instruction in a memory is flagged and explained"; thesis, a measured, honest negative or positive on whether a text classifier adds anything to the origin gate (H3 delta; 2610.07309 suggests text verifiers are weak as gates).
- **risks:** weights are about hundreds of megabytes and need a fetch step (document, pin hash); false positives on benign security notes; a classifier is bypassable, so claims must be bounded to the corpora. Prompt Guard 2 is excluded on licence.
- **acceptance:** `make run CONFIG=research/configs/ab-sec-3-injection-fixture.json` replays with zero new calls and reports precision and recall per source kind.

### AB-SEC-4: Red-team harness against Engram
- **goal:** a seeded, replayable attack suite that runs poisoning and injection attempts against `Plane.write` and `Plane.read`, in every condition (C1 to C7, per the preregistration), and tabulates what each defence stopped.
- **absorbs:** garak's probe and detector split and report shape (Apache-2.0, ideas), PyRIT's converters (obfuscation, encoding, translation; MIT, ideas), MemForm's five interfaces (Content, Evidence, Scope, Selection, Path) as the taxonomy, MINJA and AgentPoison attack recipes already in the litreview, deepset and Lakera corpora as payload sources.
- **design:** `packages/bench/src/redteam`: attack = (interface, payload generator, actor, target scope, expected invariant). Converters are pure and seeded. Output per interface: attempted, blocked at gate, flagged by lint, reached read, and the explain trail. Includes unrealistic-but-instructive cases for the cases the gate cannot stop (person-scope model content read back; forged rationale per 2607.05029) so the thesis states its limits. A Python script `research/scripts/redteam_table.py` regenerates the table (rule 9).
- **files:** `packages/bench/src/redteam/**`, `research/configs/redteam-*.json`, `research/scripts/redteam_table.py`, `research/results/MANIFEST.md`, `fixtures/redteam/`.
- **effort:** L. **depends on:** none for the gate-only version; AB-SEC-2 and 3 add rows.
- **value:** product, a `make redteam` regression suite; thesis, the missing Part I "security evaluation" chapter backing H1 beyond MEM-INV-Bench, with Selection and Path covered where nobody else has (MemForm only benchmarks models, not a plane).
- **risks:** scope creep into attacks that need a live model (use scripted models and cassettes, so every attack is a gate test, not an LLM test); data licences (MIT, Apache-2.0 data only; pin per rule 8; a preregistration entry is required first per the "what not to do" list).
- **acceptance:** `make bench BENCH=redteam` offline, byte-stable output, zero new calls.

### AB-SEC-5: Origin markers on read, and the label join for derived items (DROPPED in verification: mostly built already, see Verification)
- **goal:** every returned item carries a deterministic trust label, and a derived item takes the join of its inputs on both axes.
- **absorbs:** Spotlighting (datamarking), FIDES (integrity and confidentiality labels), CaMeL (capabilities at the point of use).
- **design:** core's explained read gains `origin` (kind, trust tier, lineage depth) per item; the MCP server and pi extension render it as a marker around the content. Core also enforces on write that a derived item's scope is no wider than the most restrictive input scope (confidentiality join), which ADR 0004 states only for integrity. Spotlighting's string form lives in the surfaces, not core.
- **files:** `packages/core/src/plane/read.ts`, `read-reason.ts`, `policy/evaluate.ts`, `packages/mcp/src/server.ts`, `packages/pi-extension/src`.
- **effort:** M. **depends on:** none. A read-schema field is an item-schema change only if it enters the generated contract; if so it is its own PR (rule 5).
- **value:** product, visible defence in depth; thesis, a cheap measurable arm (spotlighting on or off, a cassette test on LongMemEval).
- **risks:** presentation defences matter little beside admission (2610.11188); a model may ignore markers; utility cost unknown.
- **acceptance:** `make test-one T=packages/core/test/property/read-pipeline.test.ts` extended with a join property, plus `make api-check`.

### AB-SEC-6: Quarantine scope for flagged items
- **goal:** a flagged item leaves the served set without being destroyed, and can be reviewed and released.
- **absorbs:** A-MemGuard's separate lessons store, adapted to scope and event semantics.
- **design:** a lint flag with `action: quarantine` moves the item to a `quarantine:<scope>` projection that the read filter never serves; release is a governed event with a reason. Uses the existing retire/promote machinery rather than a new store.
- **files:** `packages/core/src/plane/lint.ts`, `retention.ts`, `policy` types, inspector screen.
- **effort:** M. **depends on:** AB-SEC-2 or 3. **value:** product, review workflow (MemSecBench shows in-place repair damages benign memory, so non-destructive isolation matters); thesis, a rollback metric. **risks:** a new status touches projection and replay, so the replay-equals-incremental test must cover it. **acceptance:** `make test-invariants` with an invariant that quarantined items never appear in any read.

### AB-SEC-7: Provenance attestations for exported procedures (DROPPED in verification)
- **goal:** sign a distilled procedure bundle (what, from which sessions, which replay passed) so another install can verify before adoption.
- **absorbs:** in-toto attestation shape (ideas; its repo licence reads NOASSERTION and was not resolved) and Sigstore bundles (Apache-2.0, optional).
- **files:** `packages/core/src/distill.ts`, new export in CLI. **effort:** M. **depends on:** AB-SEC-1 (key and signer). **value:** Distill's story for shared skills; low thesis value now. **risks:** key trust root unsolved for a local-first tool; defer past Gate C. **acceptance:** `engram export-procedure` then `engram verify-procedure` round trip on a fixture.

## Recommended order

1. **AB-SEC-2** (secret and PII guard): smallest effort for the largest visible gain, fully deterministic and inside the rules, directly extends the gate that H1 measures, and gives AB-SEC-4 something to attack.
2. **AB-SEC-1** (hash chain and signed checkpoints): the strongest structural claim ("every decision is logged" becomes "and cannot be changed unseen"), a clean new invariant, and no dependency. Do the erasure design with the lead before coding.
3. **AB-SEC-4** (red-team harness): turns every other plan into a table the thesis can cite, covers the MemForm interfaces Selection and Path that nothing tests, and keeps AB-SEC-3's classifier honest.

AB-SEC-3 follows once the harness exists; it is the most speculative (a text classifier is weak as a gate, per the field), so its value is the measured delta, not the defence.

## Verification (2026-11-21)

**Checked and confirmed (gh api, npm view, HF API, arXiv):** licence, stars and last push for gitleaks (MIT, 31,230), detect-secrets (Apache-2.0, 4,682), secretlint (MIT, 1,503; npm 14.0.1), trufflehog (AGPL-3.0, 29,559, ideas only), Presidio (MIT, 11,992), compromise (MIT, 12,176), redact-pii (MIT, 3.4.0, modified 2024-11-19), transformers.js (Apache-2.0, 16,439), PurpleLlama (NOASSERTION, 4,486), llm-guard (MIT, archived), rebuff (Apache-2.0, archived), garak (Apache-2.0, 10,122), PyRIT (MIT, 5,001), CaMeL (Apache-2.0, 425), FIDES (MIT, 125), Tessera (262), Trillian (3,765), Rekor (1,237), sigstore-js (188), all Apache-2.0. The ProtectAI model carries `license:apache-2.0` and an `onnx` tag, 397,882 downloads, modified 2026-07-09. Lakera gandalf and mosscap are MIT, deepset is Apache-2.0. gitleaks.toml has 222 `[[rules]]`. NeMo-Guardrails: GitHub says NOASSERTION but LICENSE.md carries the Apache-2.0 SPDX header, so the report's reading holds. arXiv ids 2503.18813, 2505.23643, 2510.02373, 2607.05029, 2610.14431, 2403.14720, 2505.03574, 2604.16548, 2606.24322 resolve to the claimed titles; 2610.07309 and 2610.11188 are existing repo notes whose arXiv titles could not be fetched (rate limit) and are left as is.

**Corrected:**
- The red-team harness conditions are C1 to C7 (the preregistration defines C7, the MCP path without read filtering), not C1 to C6.
- in-toto repo licence was confirmed NOASSERTION on GitHub; the "not resolved" statement stands, and AB-SEC-7 relied on it.
- Notes: A-MemGuard code URL (TangciuYueng/AMemGuard) is MIT, 17 stars, pushed 2026-07-02; MemForm code (opanhw/memform-code) is MIT, 2 stars, pushed 2026-11-14. Both added to the note frontmatter. No em dashes found in the report or in the notes.

**Refuted or found redundant against the code:**
- AB-SEC-5: already built in substance. ADR 0004 and `policy/promotion.ts` (`least trusted of kinds`, line 104) already join integrity over lineage; ADR 0007 source isolation keeps model and compaction content in person scope, which is the confidentiality join in practice; `packages/pi-extension/src/tag.ts` already wraps every read item in `<engram:item>` markup with metadata attributes and defuses forged tags (ADR 0009); preregistration condition C4 is exactly "metadata on each read item" against C3. Dropped.
- AB-SEC-6 as written is infeasible: `Status` is `candidate | active | retired` and a `quarantine:<scope>` scope breaks the scope grammar; a new status is a schema change (rule 5, own PR). The existing `candidate` status is the cheaper fit.
- AB-SEC-1 note: migration 1's `UPDATE events SET body` rewrites (schema_version bumps) also edit events in place, so the chain must start after the last such migration, not only handle offboarding. ADR 0003 states append-only; this needs an ADR amendment.
- Partial overlap for AB-SEC-2: ADR 0014 (finding R7-9) already redacts key-looking strings in a bypass event's reason with a small ad hoc regex set; the guard should replace that code with the shared rule table, not sit beside it.
- AB-SEC-4: "MemForm only benchmarks models, not a plane" is the report's own reading and was not verified; MEM-INV-Bench (ADR 0029) already covers laundering channels at the gate, so the red-team harness must be scoped as an extension of it, and needs a preregistration entry before any run.

**Plan verdicts:** AB-SEC-1 keep-with-fix; AB-SEC-2 keep-with-fix; AB-SEC-3 keep-with-fix; AB-SEC-4 keep-with-fix; AB-SEC-5 drop; AB-SEC-6 keep-with-fix; AB-SEC-7 drop.
