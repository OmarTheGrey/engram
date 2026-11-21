# 02-policy: policy and authorization engines

## Executive summary

ADR 0006 chose typed policy objects over a language, and the sweep supports keeping that choice for the decision path. Engram's policy is small and finite: a four-level read matrix, per-level write rules, source isolation, and per-item expiring grants. Only Cedar combines a small decidable language with an official, Lean-verified solver analyzer (SymCC). So the right use of Cedar is as a derived analysis artefact: export the typed policy to Cedar, check the export against the evaluator by differential tests in process (cedar-wasm, npm, Apache-2.0, pinned 4.14.0), and run solver queries (preset monotonicity, floor and ceiling, model-content isolation) as an optional script that shells out to the experimental cedar CLI plus cvc5. Nothing in this path puts Cedar in the core's runtime, so core stays deterministic and model-free. The "who can see this memory" query needs no engine: it is a pure core function over the read matrix and an item's grants, and Cedar or Zanzibar "expand" are only related work or a cross-check. Not absorbable: Permify (AGPL-3.0). Oso is archived. OPA, OpenFGA, SpiceDB and Cerbos are Go servers with no in-process TypeScript path.

Caveat: Cedar's SymCC is not callable from Node and needs native cvc5 1.3.1. The Cedar paper's performance numbers were seen only in a search summary.

## Landscape

Stars and dates are from `gh api` / npm on 2026-11-21.

| Name | URL | Licence | Stars, last activity | Language | What it gives us | Absorb mode |
|---|---|---|---|---|---|---|
| Cedar | github.com/cedar-policy/cedar | Apache-2.0 | 1,890; pushed 2026-11-20; v4.15.0 | Rust | Language, validator, partial evaluation (`tpe` experimental) | ideas, plus dev dependency via wasm |
| cedar-wasm | npm @cedar-policy/cedar-wasm | Apache-2.0 | 4.15.0 (2026-11-16, 5 days old, under the two-week rule). **4.14.1 (2026-11-02) is a broken publish: 2 files, 6 KB, no wasm or JS.** Newest usable pin: 4.14.0 (2026-10-19, 19 files incl. nodejs and esm builds) | Rust to WASM | In-process `is_authorized`, `is_authorized_partial` | depend (dev) |
| cedar-policy-symcc and CLI `cedar symcc` | crate `cedar-policy-symcc` inside github.com/cedar-policy/cedar (a directory, not its own repo; the release tag is cedar-policy-symcc-v0.9.0, 2026-11-16) | Apache-2.0 | symcc v0.9.0, 2026-11-16 | Rust, needs cvc5 1.3.1 (modified BSD-3 per its COPYING, verified; GitHub API says NOASSERTION; it can be configured to link GPL libraries, not by default) | Implies, equivalent, disjoint, always-allows, never-errors, with counterexamples | tool, run by script, not linked |
| cedar-spec (Lean) | github.com/cedar-policy/cedar-spec | Apache-2.0 | 228; 2026-11-20 | Lean | Verified model of evaluator and SymCC | ideas only |
| cedar-for-agents | github.com/cedar-policy/cedar-for-agents | Apache-2.0 | 62; 2026-11-19 | Rust, JS | MCP schema generator (WASM), analysis MCP server (Docker only) | ideas only |
| OPA / Rego, opa-wasm | github.com/open-policy-agent/opa | Apache-2.0 | 12,503; 2026-11-21; opa-wasm 1.10.0 last modified 2024-11 | Go | `opa test`, policy-as-code tooling; no solver analyzer | ideas only |
| OpenFGA / SpiceDB | openfga/openfga, authzed/spicedb | Apache-2.0 | 6,171 and 7,233; both pushed 2026-11-20 | Go | Zanzibar tuples, Expand and LookupSubjects | ideas only (servers) |
| node-casbin | github.com/apache/casbin-node-casbin | Apache-2.0 | 2,921; 2026-11-19 | TypeScript | PERM models; no formal analysis | ideas only |
| Oso / Polar | github.com/osohq/oso | Apache-2.0 | 3,480; archived, push 2026-10-22 | Rust | Nothing active | not recommended |
| Permify | github.com/Permify/permify | AGPL-3.0 | 5,975; 2026-11-17 | Go | Zanzibar ReBAC | **not absorbable** |
| Cerbos | github.com/cerbos/cerbos | Apache-2.0 | 4,665; 2026-11-19 | Go | Policy test fixtures format | ideas only |
| @marcbachmann/cel-js | npm | MIT | 216; 2026-11-05; 8.0.0 | JS | CEL evaluator, typed environment | later option, not now |
| AWS Verified Permissions | AWS service | proprietary | not checked | n/a | Cedar-as-a-service, schema-first policy stores, test bench (from general knowledge) | ideas only (UX) |
| z3-solver | npm | MIT | 5.4.1, modified 2026-11-11 | WASM | In-process SMT, if SymCC output is solver-portable (unverified) | open question |

Papers added as notes: 2403.04651 (Cedar), 2607.03656 (AutoCedar), 2610.29701 (BCEAC); repos: repo-cedar-toolchain, repo-policy-engines-compared.

### Can each engine be a compile target for analysis?

- **Cedar:** yes. Typed read matrix and write rules map to `permit/forbid` over an `Actor` with `level`, `source`, `memberships: Set<Scope>` and an `Item` with `scope`, `scope_level`, `class`, `status`. Time enters as context. Per-item grants are the gap: Cedar has no quantifiers, so a pattern grant (`agent:claude-code/*`) cannot be iterated. Flatten at export: each grant becomes a `Grantee` entity the actor is `in` (prefix patterns resolved against a supplied roster), or abstract the check to a boolean context flag `liveGrant`. The latter proves properties modulo grants, which must be stated plainly.
- **OPA/Rego, Casbin, CEL:** an export is easy, and none has an analyzer to run. Differential testing only; poor return.
- **OpenFGA/SpiceDB:** grants map to tuples, scope membership to relations. Their value is the "expand" query shape, but they are servers with datastores. SpiceDB can run in memory as a native binary, with no Docker, yet it is a heavy dependency for no proof capability.
- **Oso, Permify:** archived, AGPL.

Could Cedar check "who can read X"? SymCC answers yes or no for a property, not enumeration. Questions it does answer: "is there any request where a person-level actor reads an org item" (disjointness or always-denies with a counterexample), and "does policy B allow anything A does not" (implies). For enumeration, use TPE or `is_authorized_partial` with the principal unknown to get residual policies. Both partial paths are experimental or less verified; treat as a cross-check on the core function in AB-POL-3.

### Policy testing, simulation, diff UX

Engram already has `engram simulate` (workload replay under baseline and candidate, side by side) and the invariants. Gaps and ideas:
- Cedar's analyzer compare (`implies` both ways) gives an exact, workload-free diff: "candidate allows these and not those", with a counterexample request per direction. The cedar-for-agents analysis server's "policy comparison per action signature" is the UX model (Docker-only there; we do it by CLI).
- OPA `opa test` and Cerbos test files: declarative table of (actor, item, time, expected decision, expected rule id). Engram has fixtures but no authored policy-test format a lead can write by hand.
- AWS Verified Permissions and IAM Access Analyzer style "check no new access": a CI gate on a policy change that fails if the candidate widens a stated ceiling. AutoCedar's floor and ceiling is the same idea with a model in the loop.
- BCEAC suggests recording a policy hash on events so a replay can prove which policy judged.

## PR plans

### AB-POL-1: Cedar export of the typed policy, with differential tests
- **goal:** `exportCedar(policy): {schema, policies}` as a pure core function, and a test that the exported Cedar agrees with `evaluateRead` and `evaluateWrite` over generated actors, items and times, for all three presets.
- **absorbs:** Cedar language and cedar-wasm (dev dependency, exact 4.14.0; 4.14.1 is an empty publish, 4.15.0 qualifies after 2026-11-30).
- **files:** `packages/core/src/policy/cedar-export.ts` (string output, no import of cedar-wasm in src), `packages/core/test/property/cedar-export.test.ts` (imports cedar-wasm), `docs/deps.md`, `packages/core/package.json` devDependencies, an ADR (next free number; 0037 if no other plan claims it) "Cedar as an analysis export, not the decision path" (supersedes nothing; amends ADR 0006's v2 note), a log entry.
- **effort:** M
- **depends on:** none. Grants modelled as a flattened `Grantee` set at export, with the abstraction written in the ADR.
- **value:** product: policy readable by Cedar-literate security teams, AWS Verified Permissions interop. Thesis: a mechanised cross-check of the evaluator, a second implementation of the oracle's semantics.
- **risks:** Apache-2.0 fine. ADR 0006 already weighed Cedar via cedar-wasm as alternative (b) and chose typed objects; this plan keeps that choice, so the ADR is an amendment. Core must not depend on a WASM at runtime, so keep it dev-only. Datetime and ttl handling in Cedar needs care (ttl is computed from valid_from; export precomputed `expiresAt` as context). Possible semantic gaps (prefix patterns, strict-versus-subset level rules) found by the differential test would be findings worth logging.
- **acceptance:** `make test-one T=packages/core/test/property/cedar-export.test.ts`

### AB-POL-2: Analyzer-backed invariant and preset-monotonicity check
- **goal:** a script that runs `cedar symcc` on the export to verify: (a) strict implies medium implies permissive on read; (b) no policy permits model or compaction writes outside person scope; (c) no person-level reader reads org scope without a grant; each with a counterexample on failure, plus a floor and ceiling file for a candidate policy.
- **absorbs:** cedar-policy-symcc (via CLI experimental archive) and cvc5 1.3.1; floor and ceiling from AutoCedar.
- **files:** `research/scripts/policy_analyze.py`, `research/configs/policy-analyze.json`, `research/results/policy-analyze.json`, MANIFEST row, Makefile target `make policy-analyze` and AGENTS.md command line, `docs/deps.md` rows for the binaries (tools, not packages), a log entry.
- **effort:** M
- **depends on:** AB-POL-1.
- **value:** product: a "prove it" gate on policy edits. Thesis: Cedar-verified invariants beside the seven property tests, a distinctive chapter result.
- **risks:** needs a native binary; fetched, never Docker. The CLI feature is experimental, so pin exact versions. cvc5 is modified BSD-3 (verified from its COPYING). `make test-repro` would need the native binaries too, so give the row a skip-unless-present guard. Excluded from `make test` and CI (CI is nonfunctional anyway, and `make test-repro` fetches already). Proofs hold modulo the grant abstraction.
- **acceptance:** `make policy-analyze` exits 0 on the presets and exits 1 with a counterexample on a deliberately widened fixture policy.

### AB-POL-3: "Who can see this memory" query
- **goal:** `Plane.whoCanRead(actor, itemId, at)` and `whoCanReadItem(policy, item, at)` returning a symbolic reader set, not an enumeration: `{ by_scope: { levels, members_of: scope }, by_grants: [{to, class, expires, live}], excluded: [{reason}] }`, with reasons in the read rule ids. Routes: `POST /api/v1/who-can-read`, CLI `engram who-can-read <item>`, inspector panel on the item.
- **absorbs:** SpiceDB LookupSubjects and OpenFGA Expand as the shape; optional Cedar `is_authorized_partial` as a cross-check in tests.
- **files:** `packages/core/src/policy/who-can-read.ts` (build on the existing `readableAt`, `liveGrants`, `reachable`, `grantMatches` in `policy/evaluate.ts`, do not re-derive them), `packages/core/src/plane/who.ts`, `packages/server/src/routes.ts`, `packages/cli/src`, `packages/ui/src`, `make api` outputs, tests under `packages/core/test/unit` and a property test that agrees with `readable` for every actor in a generated roster.
- **effort:** M
- **depends on:** none. Visibility rule: only the item's owner or a member who may read it may ask (same refusal as unknown, as ADR 0034 decision 2), since the answer reveals grants. This is a privacy decision needing the lead's review.
- **value:** product: the directly asked question of a governance plane, and a Twin consent screen ("who can see my memory"). Thesis: explainability beyond a single recall.
- **risks:** leaks who holds grants (see ADR 0034 decision 9); an API route needs an ADR. Time-dependence: answer is at `at`, give the next change instant as well (earliest expiry or ttl).
- **acceptance:** `make test-one T=packages/core/test/property/who-can-read.test.ts`

### AB-POL-4: Declarative policy test files
- **goal:** a `*.policy-test.yaml` format (actor, item, time, expected decision and rule id) run by `engram policy test <policy> <file>`, with an explain-on-failure output, plus a starter suite per preset.
- **absorbs:** OPA `opa test` and Cerbos test fixture shapes (ideas).
- **files:** `packages/core/src/policy/test-file.ts`, `packages/server/src/routes.ts` (a route that runs the file; the CLI holds no policy logic, rule 1, and is one call of the generated client), `make api` outputs, `packages/cli/src/commands.ts`, `fixtures/policy-tests/*.yaml`, Makefile and AGENTS.md command, docs.
- **effort:** S
- **depends on:** none.
- **value:** product: policy authors get unit tests without TypeScript. Thesis: the presets' intended behaviour as executable documentation.
- **risks:** none on licence. Overlaps with simulate; keep it a decision-level test and simulate a workload-level one.
- **acceptance:** `make engram ARGS="policy test packages/core/policies/medium.yaml fixtures/policy-tests/medium.yaml"`

### AB-POL-5: Policy diff report and ceiling gate
- **goal:** `engram policy diff <a> <b>` printing a structural diff (matrix cells, write rules, retention) and, when the analyzer is present, the semantic diff both ways with one counterexample each; `--ceiling <file>` fails if the candidate widens it. Optional `policy_hash` recorded in events.
- **absorbs:** Cedar implies-both-ways compare; AWS-style "check no new access"; BCEAC binding.
- **files:** `packages/core/src/policy/diff.ts`, a server route plus `make api` outputs (the CLI only calls the client), `packages/cli/src/commands.ts`, `packages/ui/src` (diff view in the simulator screen), `research/scripts/policy_analyze.py` extension; the `policy_hash` field is a separate schema PR (rule 5).
- **effort:** M (S without the semantic half)
- **depends on:** AB-POL-4 for the structural half; AB-POL-2 for the semantic half.
- **value:** product: reviewable policy changes, the missing UX beside `simulate`. Thesis: change-safety argument for the policy under H2.
- **risks:** the semantic half is optional because of the native binary; the structural half must stand alone.
- **acceptance:** `make test-one T=packages/core/test/unit/policy/diff.test.ts`

### AB-POL-6 (optional, M): Cedar import of a restricted subset
- **goal:** read a Cedar file into the typed policy only when it falls in the compiled subset, else refuse with the offending rule.
- **absorbs:** cedar-wasm `policy_to_json`.
- **files:** `packages/core/src/policy/cedar-import.ts`, tests.
- **depends on:** AB-POL-1.
- **value:** interop. Low thesis value.
- **risks:** round-tripping hazards; skip unless a customer asks.
- **acceptance:** `make test-one T=packages/core/test/unit/policy/cedar-import.test.ts`

## Recommended order

1. **AB-POL-3 (who can see)**: highest product value, no dependency or licence risk, and it needs only core code. Settle the privacy rule with the lead first.
2. **AB-POL-1 (Cedar export with differential tests)**: the foundation for the thesis result, stays in process, dev dependency only. It may also surface real evaluator discrepancies.
3. **AB-POL-2 (analyzer check)**: the headline "verified invariants" result, after AB-POL-1; run it by script so the native binary never reaches CI or runtime.

AB-POL-4 is a cheap good fourth and can go alongside any of them.

## Verification (2026-11-21)

Checked:
- Repos by `gh api`: cedar 1,890 stars Apache-2.0 pushed 2026-11-20; cedar-spec 228; cedar-for-agents 62; OPA 12,503; OpenFGA 6,171; SpiceDB 7,233; casbin-node 2,921 (apache/casbin-node-casbin); Oso 3,480 archived; Permify 5,975 AGPL-3.0; Cerbos 4,665; cel-js 216 MIT; apache/casbin 20,509; openfga/language 35. All numbers and licences matched.
- npm: cedar-wasm Apache-2.0, latest 4.15.0 (2026-11-16); cel-js 8.0.0 MIT; z3-solver 5.4.1 MIT (2026-11-11); opa-wasm 1.10.0 Apache-2.0, last modified 2024-11-08; casbin 5.51.1 Apache-2.0. Matched.
- arXiv abs pages: 2403.04651 (Cedar), 2607.03656 (AutoCedar, 221 CedarBench tasks), 2610.29701 (BCEAC, 72 scenarios, 144 strict records, 120 + 24, 8 controls). Titles and numbers match.
- Code: `packages/core/src/policy/{evaluate,grants,load,promotion,retention}.ts`, `policies/{strict,medium,permissive}.yaml`, `plane/*.ts`, `visible.ts` exist; no existing who-can-read, policy test, policy diff, policy_hash or Cedar code. `policy_id` is already on events; the hash is not.

Corrected:
- cedar-wasm 4.14.1 is a broken npm publish (2 files, no wasm); the pin is now 4.14.0. The same fix is in the note repo-cedar-toolchain.
- cedar-policy-symcc is a directory of the cedar repo, not a separate repository; `gh api repos/cedar-policy/cedar-policy-symcc` returns 404.
- cvc5 licence resolved: modified BSD-3 (COPYING), default build links no GPL library.
- AB-POL-3 builds on `readableAt`, `liveGrants` and `reachable` already in core; it is not a from-scratch function.
- AB-POL-4 and AB-POL-5 named CLI work without a server route; the CLI holds no policy logic, so each needs a route and `make api`.
- ADR number 0037 may collide with another research plan; take the next free number.
- The Cedar paper's 28.7x to 35.2x and 42.8x to 80.8x speed-ups are not in the abstract (it says only "performs far better"); unverified until the paper body is read.

Refuted: none of the licence or star claims. Permify AGPL-3.0 holds (not absorbable).
