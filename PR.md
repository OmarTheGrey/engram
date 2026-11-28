## Card

E9.11 Crypto-shredded erasure: the ADR and the key side table (`docs/tasks/E9.11.md`, absorb plan 2, pull request 21 of 30).

## Plan

1. ADR 0051 (proposed): one versioned data key per person scope, wrapped under an operator key behind an injected provider, the scope and version as the wrap's associated data; shredding adds to ADR 0010's redaction and replaces nothing; ADR 0038's commitments and salt deletion and E1.9's attestation digests unchanged; decision 38a's merging hashes kept from plaintext and never shredded; backups reached by rotating the operator key; what is not protected.
2. Migration 7, `data_keys`, on SQLite and Postgres. A side table, no `schema.ts` change, no `schema_version` bump.
3. `packages/core/src/crypto/keys.ts`: `KeyProvider` (injected), `ensureDataKey`, `openDataKey`, `dataKeyState`, `shredDataKeys`, `rewrapDataKeys`. Core draws no randomness, reads no clock and does no key I/O.
4. Off everywhere: nothing calls it yet, and `erasure.mode` stays in `NOT_BUILT_YET` until E9.13.

Acceptance: `make lint-docs` and `make test-one T=packages/core/test/unit/crypto/keys.test.ts`

## Evidence

```
make test-one T=packages/core/test/unit/crypto/keys.test.ts
      Tests  32 passed (32)        (the suite on SQLite and on embedded Postgres, after the review fixes)
make test-invariants
      Tests  21 passed (21)
make lint          exit 0
make lint-docs     exit 0
```

A shredded row, from the test: `wrapped` NULL, `shredded_at` set, `dataKeyState` gives `{ state: "shredded", version: 1, shredded_at: "2026-11-28T11:00:00.000Z" }`, and `ensureDataKey` refuses to re-key the scope.

## Review fixes

The independent review (approve with changes): the provider's nonce contract, every wrap verified to open before it is stored, rotation refuses the same operator key, the algorithm checked on unwrap, core's Timestamp for times; the ADR lists what stays plaintext in pre-redaction copies, writes promotions unsealed, refuses writes into a shredded scope under shred, states rotation's cost to backups and the residue mitigations; the three surviving mutants are killed.

## Log entries

- docs/log/2026-11-28-e9-11-change-key-table.md
- docs/log/2026-11-28-e9-11-change-adr.md
- docs/log/2026-11-28-e9-11-decision-adds-to-redaction.md
- docs/log/2026-11-28-e9-11-decision-key-unit.md
- docs/log/2026-11-28-e9-11-decision-rotation.md
- docs/log/2026-11-28-e9-11-decision-outside-chain.md
- docs/log/2026-11-28-e9-11-decision-no-poc.md
- docs/log/2026-11-28-e9-11-finding-for-e9-13.md
- docs/log/2026-11-28-e9-11-finding-guard.md
- docs/log/2026-11-28-e9-11-failure-erasable-syntax.md
- docs/log/2026-11-28-e9-11-failure-mutation-shell.md
- docs/log/2026-11-28-e9-11-failure-chain-migration-order.md
- docs/log/2026-11-28-e9-11-change-review-fixes.md
- docs/log/2026-11-28-e9-11-decision-lint-evidence.md
- docs/log/2026-11-28-e9-11-decision-wrap-algorithm.md
- docs/log/2026-11-28-e9-11-failure-rebuild-timeout.md

## Checklist

- [x] Acceptance passes locally
- [x] Tests the testing convention requires (both backends, fakes, seeded provider, injected times; mutation checked)
- [x] Log entries, failures included
- [x] `docs/absorbed.md` row (Compartment, port of the design); no copy, so no NOTICE entry
- [x] ADR drafted (XXXX, proposed)
- [x] No dependency added; no schema change; no registered byte moves

🤖 Generated with [Claude Code](https://claude.com/claude-code)
