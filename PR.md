## Card

E2.18 Preset properties proved by Cedar's symbolic compiler (second absorb plan, pull request 20 of 30; ADR 0041, decision 6).

## Plan

1. Spike on this Windows machine: build cedar-policy-symcc 0.8.1 with cargo and run cvc5 1.4.2's Win64 release. It works, offline once fetched (`docs/log/2026-11-28-e2-18-spike-symcc-on-windows.md`).
2. `tools/symcc`: a small Rust binary that checks, for every request of one action, whether one Cedar policy set implies another, returning a counterexample that Cedar's own authorizer rechecks. TypeScript beside it (`properties.ts`, `cli.ts`) writes the checks over card E2.12's `exportCedar` and replays each counterexample through `evaluateRead` or `evaluateWrite`, after checking the decode round-trips.
3. `research/scripts/h2_cedar_properties.py` from `research/configs/h2-cedar-properties.json` into `research/results/h2-cedar-properties.json` (`"hypothesis": "none"`, `"status": "proof of concept"`), with its MANIFEST row and its register section; the register gains the status `proof of concept`, with a test.
4. `make verify-policy`, outside `make test`: the script into `.engram/verify-policy`, compared with the committed result; skips with a message when cargo or cvc5 is missing.

Nothing in `packages/` changes. No registered preset, condition or config moves.

## Acceptance

Acceptance: `make verify-policy`

## Evidence

```
proved   read-monotone/strict-before-medium/read (as expected)
proved   read-monotone/medium-before-permissive/read (as expected)
proved   model-write-person-scope/{strict,medium,permissive}/{write,write_without_review} (as expected, six checks)
proved   person-read-needs-grant/{strict,medium,permissive}/read (as expected, three checks)
refuted  read-monotone-reversed/medium-before-strict/read (as expected)
  evaluator: medium allows True, strict allows False; reproduced True; decoded faithfully True
refuted  read-monotone-reversed/permissive-before-medium/read (as expected)
  evaluator: permissive allows True, medium allows False; reproduced True; decoded faithfully True
13 checks: 11 proved, 2 refuted (2 reproduced by the evaluator); 13 as expected
verify-policy: every property as expected, and the result is the committed one
```

Results excerpt, `research/results/h2-cedar-properties.json`, `summary`: `{"all_as_expected": true, "as_expected": 13, "checks": 13, "proved": 11, "refuted": 2, "reproduced": 2}`; sha256 `e36dc45356e7346034c7487e0ae43237e25bc10b780a12e83ffa1a9ce5ddcc29`, the same over five runs. Proofs hold modulo grants (ADR 0041, decision 5) and for the requests the domain admits (`scope.domain`).

## Log entry

- docs/log/2026-11-28-e2-18-spike-symcc-on-windows.md
- docs/log/2026-11-28-e2-18-change-symcc-tool.md
- docs/log/2026-11-28-e2-18-change-verify-policy.md
- docs/log/2026-11-28-e2-18-measurement-cedar-properties.md
- docs/log/2026-11-28-e2-18-change-register-status.md
- docs/log/2026-11-28-e2-18-decision-domain.md
- docs/log/2026-11-28-e2-18-decision-property-reading.md
- docs/log/2026-11-28-e2-18-decision-control-property.md
- docs/log/2026-11-28-e2-18-decision-decode-round-trip.md
- docs/log/2026-11-28-e2-18-decision-tool-pins.md
- docs/log/2026-11-28-e2-18-finding-modulo-grants.md
- docs/log/2026-11-28-e2-18-failure-has-guard.md
- docs/log/2026-11-28-e2-18-failure-person-read-parens.md
- docs/log/2026-11-28-e2-18-failure-normalise-renamed-engram-ids.md
- docs/log/2026-11-28-e2-18-failure-build-steps.md

## Checklist

- [x] acceptance command passes locally
- [ ] make test passes (not run in full on the shared machine, per the brief; the scripts project, 511 tests, and the research tests touched, 94, pass)
- [x] tests required by docs/conventions/testing.md are included
- [x] docs/deps.md updated if a dependency was added
- [x] docs/absorbed.md and NOTICE updated if code or data was copied or ported (ADR 0037): nothing copied; both tools are depended on
- [x] AGENTS.md updated if a rule or command changed
- [x] ADR added if a choice another card could have made differently: none needed; ADR 0041 decision 6 covers it
- [x] no em dashes in prose

🤖 Generated with [Claude Code](https://claude.com/claude-code)
