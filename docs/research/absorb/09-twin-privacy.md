# 09 Twin and privacy: research report (2026-11-21)

## Executive summary

Engram's Twin erasure today is redaction: offboarding deletes the person scope from store and projection and rewrites earlier log events to blank content (ADR 0010, `packages/core/src/plane/offboard.ts`). That makes the log append-only "apart from this redaction", and the erasure is asserted by a report rather than provable. The 2026 literature says the real risk is elsewhere: derived copies (AfterDeleteBench 2610.31366: about two thirds recovery of a deleted secret; Deployment-Time Memorization 2606.10062: raw-only deletion leaves summary copies recoverable in about 20 percent of cases) and users' memory-control instructions that systems ignore (MemCtrl: ChatGPT and Claude surface restricted information in 77 to 83 percent of controlled cases). The best absorbable material is small: Node's built-in WebCrypto (AES-GCM, HKDF) is enough for per-person key shredding with no new dependency; `age` (typage, BSD-3) gives a portable passphrase or recipient encryption format for export; DP libraries are Python, Rust or Java only, so DP noise is a short TypeScript port validated against OpenDP in research/. Local-first sync stacks (Automerge, Keyhive, ElectricSQL, PowerSync) are real but out of scope for a single-machine plane; take ideas, not code. Top three: crypto-shredding erasure with derived-item closure, an encrypted person scope built on the same keys, and a portable export and import.

## Landscape

Stars and dates are from `gh api` on 2026-11-21 unless marked.

| Name | URL | Licence | Stars, last push | Language | What it gives us | Mode |
|---|---|---|---|---|---|---|
| Node WebCrypto (node:crypto) | nodejs.org | MIT (Node) | n/a | JS | AES-256-GCM, HKDF, CSPRNG, no dependency | depend (builtin) |
| typage (age for JS; npm package `age-encryption` 0.3.1, BSD-3-Clause, published 2026-08-28, pre-1.0) | github.com/FiloSottile/typage | BSD-3-Clause | 504, 2026-08-28 | TypeScript | age format: passphrase and X25519 recipients, portable encrypted export | depend |
| age | github.com/FiloSottile/age | BSD-3-Clause | 24,399, 2026-08-29 | Go | the format spec and test vectors | ideas only |
| noble-ciphers / noble-curves | github.com/paulmillr | MIT | 437 / 973, Sept 2026 | TypeScript | audited pure-JS primitives if WebCrypto lacks one (XChaCha20) | depend, only if needed |
| libsodium | github.com/jedisct1/libsodium | ISC (LICENSE file read; gh API reports NOASSERTION) | 14,071, 2026-11-18 | C | secretbox, sealed boxes | ideas only (JS wrapper repo not verified) |
| OpenMLS | github.com/openmls/openmls | MIT | 1,071, 2026-11-20 | Rust | MLS group keys; multi-party, not single-user | ideas only |
| Keyhive / Beelay | github.com/inkandswitch/keyhive | Apache-2.0 | 280, 2026-11-20 | Rust | capability certificates plus E2EE sync; pre-alpha per the project | ideas only |
| Automerge | github.com/automerge/automerge | MIT | 6,747, 2026-11-20 | JS and Rust | CRDT documents for multi-device sync | ideas only (not needed for single-machine plane) |
| Yjs | github.com/yjs/yjs | MIT (LICENSE file read; gh API reports NOASSERTION) | 23,094, 2026-11-16 | JS | CRDT | ideas only |
| Loro | github.com/loro-dev/loro | MIT | 6,311, 2026-11-18 | Rust and WASM | CRDT with history | ideas only |
| ElectricSQL | github.com/electric-sql/electric (gh redirects to neondatabase/electric) | Apache-2.0 | 10,434, 2026-11-18 | TypeScript, Elixir | Postgres sync to clients | ideas only |
| PowerSync | github.com/powersync-ja/powersync-js | Apache-2.0 | 742, 2026-11-19 | TypeScript | SQLite sync with Postgres backend | ideas only |
| cr-sqlite | github.com/vlcn-io/cr-sqlite | MIT | 3,834, 2026-08-10 | Rust | CRDT SQLite extension; Engram's log is already SQLite | ideas only |
| Solid Community Server | github.com/CommunitySolidServer | MIT | 613, 2026-11-09 | TypeScript | pods, WAC and ACP access models | ideas only |
| Data Transfer Project | github.com/dtinit/data-transfer-project | Apache-2.0 | 3,626, 2026-11-18 | Java | portability adapter model (exporter, importer, data model) | ideas only |
| OpenDP | github.com/opendp/opendp | MIT | 448, 2026-11-21; v0.16.0 2026-10-06 | Rust, Python | discrete Laplace, accountant; no TS or WASM package found | depend in research/ (Python) |
| Google differential-privacy | github.com/google/differential-privacy | Apache-2.0 | 3,378, 2026-11-20 | C++, Go, Java, Python | DP aggregation reference | ideas only |
| Claude memory import and export | support.claude.com article 12123587 | n/a | n/a | n/a | the portability flow is paste text from another provider; no machine format documented | ideas only |

Not found: a documented ChatGPT memory export schema (searched; none located). Solid and DTP were not read in depth; their rows rest on repo metadata.

Papers noted (in litreview): 2610.31366, 2606.10062, MemCtrl (NeurIPS 2026 workshop), Keyhive, DP libraries, crypto-shredding pattern. Existing notes already cover 2610.18052 (BEMULA, "Can Agents Forget When Asked?") and 2411.10109 (1,000 People; its arXiv v2 title is now "AI Simulations Grounded in Rich Self-Reports Increase Accuracy and Reduce Distortion"). I read only abstract pages for the new papers.

## PR plans

### AB-TWN-1: Crypto-shredded erasure with per-person keys
- goal: person-scope event payloads and item content are stored encrypted under a per-person data key; offboarding destroys the key and appends an erasure event naming the key id. Erasure is then provable: a test decrypts every prior ciphertext and fails. Close the log-redaction path, so the log is genuinely append-only. Report derived items by provenance closure (AfterDeleteBench) in the deletion report. Verification note: the plane already sweeps store records whose lineage names an erased id (offboard.ts sweep, ADR 0010), and the lead decided on 2026-11-20 (decision 38a) that promotions made before offboarding stay as the target scope's knowledge, so the closure may list and flag promoted descendants but must not delete them unless the lead reopens decision 38.
- absorbs: crypto-shredding pattern (practitioner); node:crypto AES-256-GCM, HKDF; closure idea from 2610.31366.
- files: `packages/core/src/keys.ts` (new, key hierarchy: master key wraps per-person DEK), `plane/offboard.ts`, `plane/commit.ts`, `db/migrate.ts`, `schema.ts` (schema PR rule 5: one PR, so split the schema change into a preceding PR AB-TWN-1a), `docs/decisions/` amendment to ADR 0010.
- effort: L
- depends on: none merged-blocking; the schema part first.
- value: product: erasure a leaver or a regulator can check. Thesis: replaces an assertion with a testable property; adds an eighth invariant (seven exist today) "no ciphertext of an erased person decrypts" and an FRS-style residue score.
- risks: no licence risk (builtin). Store adapters still hold plaintext (files, Mem0, Letta); shredding only covers the log and projection unless adapters receive ciphertext, so a store-side residual remains and must be reported. Key loss equals data loss. No regulator position found on Article 17 sufficiency; needs legal review. Hashes left in events can confirm plaintext; use keyed HMAC hashes under the person key. Verification note: decision 38a keeps merging content hashes of erased content so adoption can refuse a copy under a new id (events.ts erasedScopeContent); an HMAC under a destroyed person key cannot do that, so the refusal hashes need a separate, non-shredded plane key or stay as they are, and this must be decided before coding. Also coordinate with AB-SEC-1 and AB-CMP-2 (04-security.md, 13-compliance.md), which solve the same redaction-versus-tamper-evidence conflict with salted commitments; the two designs must be one design. `keys.ts` in core must take an injected key provider (core does no key I/O).
- acceptance: `make test-one T=packages/core/test/unit/plane/shred.test.ts` (offboard, then every event body for the person fails to decrypt, replay still equals projection, derived item flagged) and `make test-invariants`.

### AB-TWN-2: Encrypted person scope at rest (and Withhold and Incognito verbs)
- goal: the person scope's item bodies are encrypted in the log and, through an adapter wrapper, in the files store; a passphrase-derived master key (node:crypto scrypt) unlocks; an OS keychain would need a native dependency and is out of the plan. Add the three MemCtrl verbs as policy: Incognito (write-gate rule `engram/write/incognito`, per session), Forget (the erase of AB-TWN-1 for one item), Withhold (read-filter suppression with expiry).
- absorbs: MemCtrl design; age or WebCrypto envelope.
- files: `packages/core/src/policy/*` (rules), `plane/read.ts`, `packages/adapters/src/files/*` (encrypting wrapper), `packages/pi-package/profiles/twin.yaml`, `packages/cli/src/*` (unlock flow).
- effort: L
- depends on: AB-TWN-1; Withhold needs a schema field, so a separate schema PR first.
- value: product: Twin matches users' expectation of control. Thesis: a Twin arm measuring MemCtrl-style violation rate for Engram (expected zero by construction) against the five systems' published numbers.
- risks: search over encrypted bodies is impossible, so retrieval needs decrypted in-memory index within the process; the guarantee is at-rest only. Encrypting the files store breaks users who edit memory files by hand and the files adapter's adoption of the Claude Code memory folder (ADR 0013 conformance, ADR 0028), so scope it to Engram-written stores, opt-in.
- acceptance: `make test-one T=packages/adapters/test/plane/encrypted-files.test.ts`; policy tests for the three verbs.

### AB-TWN-3: Portable memory export and import (engram-memory bundle)
- goal: Verification note: the vendor-format importers (ChatGPT, Claude paste) belong to AB-STO-3 in 01-stores.md; this plan keeps only the Engram-native bundle and its age encryption, and must share the `engram import` and `engram export` commands with AB-STO-3. `engram export --owner <id>` writes a bundle (JSONL of items with provenance, grants, validity windows, and the decision events for them) optionally age-encrypted; `engram import` reads it through the write gate with source `import`, so imported content never gains trust (ADR 0004, RV4). The plain-text importer for other providers' exports is AB-STO-3's, not this PR's.
- absorbs: age via typage for the encryption; DTP's exporter and importer split as the module shape; Solid's idea of a user-owned data portion.
- files: `packages/cli/src/commands.ts` (no `export` command exists yet; add a file beside it), `packages/server/src/routes.ts` (route table; then `make api`), `packages/core/src/export.ts` (bundle schema as pure functions), `docs/deps.md` (typage row, BSD-3), `docs/architecture.md`.
- effort: M
- depends on: none for the plaintext bundle; AB-TWN-1 if the bundle should carry decrypted data only after unlock.
- value: product: Twin data portability, a GDPR Article 20 story, and migration from other providers. Thesis: a round-trip invariant (export then import into a fresh plane yields the same visible set per reader).
- risks: typage is small (504 stars), single-maintainer-adjacent though by the age author; pin exactly. Import of grants must be dropped, not trusted (ADR 0034 precedent). A bundle with another person's content leaks if exported from a shared scope, so export is limited to scopes the actor owns.
- acceptance: `make test-one T=packages/cli/test/export-roundtrip.test.ts` and an e2e step in `make test-e2e`.

### AB-TWN-4: DP-noised aggregate dogfood report
- goal: add `--dp-epsilon` to `make dogfood-report`, releasing the report's counts with discrete Laplace noise, with a per-member privacy budget ledger kept locally so repeated releases are accounted for. Cross-check the TypeScript sampler against OpenDP in a Python test under research/.
- absorbs: OpenDP (Python, MIT) as the reference; Google differential-privacy design notes; the discrete Laplace choice.
- files: `packages/core/src/dogfood.ts`, `packages/core/src/dp.ts` (new), `packages/core/scripts/dogfood-report.ts` (the original path `scripts/` was wrong), `research/scripts/dp_check.py`, `research/configs/dp-check.json`, `docs/dogfood.md`, `docs/deps.md` (opendp, research only).
- effort: S to M
- depends on: none.
- value: product: members can share counts across machines with a stated guarantee. Thesis: modest; a method for reporting without leaking, and rule 12 already allows exact aggregates.
- risks: counts are tiny, so useful epsilon gives large relative noise; a single member's counts are not a good DP target (the sensible unit is across members). Hand-rolled sampler risk: use node:crypto randomness, test statistics with a fixed seed, and call the guarantee conditional. Do not describe it as DP-certified.
- acceptance: `make test-one T=packages/core/test/unit/dp.test.ts` and `uv run python research/scripts/dp_check.py --config research/configs/dp-check.json`.

### AB-TWN-5: Residue benchmark for erasure (FRS and matched control)
- goal: a fixture-backed benchmark arm: inject canary facts into a person scope, build derived items (a summary, a promoted item, a Distill procedure), erase, and score residue across tiers; matched never-exposed control from AfterDeleteBench. Scripted model, cassettes.
- absorbs: 2610.31366 and 2606.10062.
- files: `packages/bench/src/erasure/*`, `fixtures/workspaces/erasure/*`, `research/configs/h6-erasure.json`, `research/scripts/h6_erasure.py`, and a preregistration entry (rules: add to `docs/research/preregistration.md` first, reviewed; the prereg has H1 to H5 only, so "H6" is a new hypothesis, not an existing slot). Verification note: derived items promoted out of the person scope stay by decision 38a, so the arm must report them as retained by decision, not as residue; the arm can run now against today's redaction-based erase, so the dependency on AB-TWN-1 is dropped and the arm also serves as the before arm for it.
- effort: M
- depends on: preregistration PR (AB-TWN-1 optional, for the after arm).
- value: thesis: a measured claim "Engram erasure leaves zero residue where raw-only deletion leaves about 20 percent" would be reproducible on our fixtures, not a quote of theirs. Product: regression guard.
- risks: both papers use synthetic secrets and no code; I read only abstracts. The benchmark must not be framed as replicating them.
- acceptance: `make bench BENCH=erasure` offline.

### AB-TWN-6: Signed grants and a verifiable consent receipt
- goal: when the owner changes a grant, the plane issues a signed consent receipt (Ed25519 via node:crypto over the grant event hash) that a grantee or auditor can verify offline; store the receipt in the event.
- absorbs: Keyhive's capability-certificate idea; Solid ACP concept; no code.
- files: `packages/core/src/plane/grants.ts`, `schema.ts` (separate schema PR), `packages/server/src/routes.ts`.
- effort: M
- depends on: AB-TWN-1 for key custody.
- value: product: consent evidence. Thesis: auditability claim extended to grants.
- risks: key custody on a single machine means the signer is the same party as the plane, so the receipt proves the log had the decision, not that the human consented; say so.
- acceptance: `make test-one T=packages/core/test/unit/plane/grant-receipt.test.ts`.

Deliberately not planned: multi-device sync. Adopting Automerge, ElectricSQL or PowerSync would put sync and conflict semantics beside the log's lock-ordered commit protocol (ADR 0007, card E2.6) and would need its own ADR; revisit after AB-TWN-1 and 2 if the lead wants Twin on several devices.

## Recommended order

1. AB-TWN-1 (crypto-shredded erasure). It turns the thesis's strongest Twin claim from asserted to checkable, needs no new dependency, and AB-TWN-2, 5 and 6 build on its key hierarchy.
2. AB-TWN-3 (export and import). Medium effort, independent of the key work for the plaintext form, one small dependency, and the clearest user-visible Twin feature.
3. AB-TWN-2 (encrypted person scope with MemCtrl verbs), because it delivers the control semantics users and the 2026 literature measure, once keys exist. AB-TWN-4 is a quick standalone win if the lead wants it earlier.

## Unverified

- Licences of libsodium (ISC) and Yjs (MIT) were verified in the Verification section.
- No ChatGPT or Claude memory export schema found; Claude's flow is described only through search summaries of its help article.
- Keyhive status (pre-alpha) and the Automerge/Loro comparison come from search summaries of Ink and Switch pages.
- New papers read at abstract level only; crypto-shredding sources are practitioner posts seen as search summaries; Article 17 sufficiency not established.
- Solid and Data Transfer Project were not read beyond repo metadata.

## Verification (2026-11-21)

Checked:
- All 17 GitHub repos via `gh api`: licence, stars and pushed_at match the table (typage 504, age 24,399, noble-ciphers 437, noble-curves 973, libsodium 14,071, OpenMLS 1,071, Keyhive 280, Automerge 6,747, Yjs 23,094, Loro 6,311, Electric 10,434 under neondatabase/electric, PowerSync 742, cr-sqlite 3,834, Solid server 613, DTP 3,626, OpenDP 448, Google DP 3,378).
- npm: `age-encryption` 0.3.1 BSD-3-Clause (2026-08-28); `@noble/ciphers` 2.4.0 MIT. libsodium LICENSE file is ISC; Yjs LICENSE file is MIT. Not checked: the Claude help article body (the URL answers 301).
- arXiv abs pages: 2610.31366 (AfterDeleteBench: two thirds, 62 to 99 percent), 2606.10062 (Deployment-Time Memorization: about 20 percent, 76 and 64 percent), 2610.18052 and 2411.10109 resolve; 2411.10109 now carries a new title (noted inline). The MemCtrl event page confirms 77.4 to 83.3 percent and five systems plus two chatbots.
- Litreview notes (2610.31366, 2606.10062, memctrl-neurips-2026, methods-crypto-shredding, repo-keyhive, repo-differential-privacy-libs, repo-chatgpt-claude-memory-formats): frontmatter ids and code URLs are right, no em dash found. The Axon crypto-shredding repo is Apache-2.0, 10 stars, last push 2023-11-30 (stale). Two notes understated existing code and were corrected.

Corrected:
- AB-TWN-1: the plane already sweeps lineage-derived store records, and decision 38a (2026-11-20) keeps promotions, so "no derived-item closure yet" and the delete-derived goal were narrowed to listing. Keyed-HMAC hashes conflict with decision 38a's adoption-refusal hashes. Overlap with AB-SEC-1 and AB-CMP-2 flagged. Invariant count is eighth, not "seventh-plus".
- AB-TWN-2: OS keychain dropped (native dependency); ADR citation fixed.
- AB-TWN-3: vendor importers belong to AB-STO-3; one shared command.
- AB-TWN-4: the dogfood-report path is `packages/core/scripts/dogfood-report.ts`.
- AB-TWN-5: no existing H6; promoted derived items are retained by decision, not residue.

Refuted or dropped:
- AB-TWN-4 (DP counts): the plan's own risks say one member is the wrong DP unit, rule 12 already allows exact aggregates, and the value is thesis-modest.
- AB-TWN-6 (signed consent receipt): duplicates AB-SEC-1 and AB-CMP-1 signed checkpoints and audit exports, and by its own admission proves nothing about the human's consent.
