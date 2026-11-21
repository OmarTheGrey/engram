# 17-performance: benchmarking, speeding up and shipping the plane

## Executive summary

Engram has no performance evidence today: no latency benchmark, no budget, no single-file build. Reading the code shows why that matters. Every `Plane.read` calls `currentItems(db)` twice (snapshot, then again under the write lock, `packages/core/src/plane/read.ts` lines 142 and 172), and each call is `SELECT body FROM items ORDER BY id` followed by `JSON.parse` of every row (`events.ts` line 239). A read is therefore O(total items in the log), not O(reachable items), and the cost grows with every scope. `openSqlite` sets WAL and a busy timeout only; there are 38 `.prepare(` call sites in `packages/core/src`, each preparing again per call; every append runs a Zod parse plus `JSON.stringify` of the whole event. These are the likely hot spots, but none is measured, so the first PR must be the measurement. The best tools are small and permissive: tinybench (MIT) for harnessing, `node:sqlite`'s own `sqlite.db.query` diagnostics channel for deterministic statement counts, and a local budget file in the style of `research/results/`. For shipping, Node SEA is CJS-only on Node 24 and needs an esbuild bundle first; Bun compile is the easy cross-target alternative but moves the runtime off the thesis base. Durability caveat: `synchronous=NORMAL` is faster but can lose the last commits on power loss, which fights the audit claim, so it must be opt-in. CI is nonfunctional, so every gate here is a local `make` target and wall-time is never the gate.

## Landscape (stars, licence, dates from `gh api`, 2026-11-21 unless noted)

| Name | URL | Licence | Stars, last push | Lang | Gives us | Mode |
|---|---|---|---|---|---|---|
| tinybench | github.com/tinylibs/tinybench | MIT | 2,385, 2026-11-21 | TS | micro-benchmark harness, raw samples, async, abort | depend (dev) |
| mitata | github.com/evanwashere/mitata | MIT | 2,546, 2025-02-17 | JS | alternative harness, stale | ideas only |
| autocannon | github.com/mcollina/autocannon | MIT | 8,544, 2026-11-16 | JS | HTTP load test with latency histogram, in-process API | depend (dev) |
| oha | github.com/hatoo/oha | MIT | 10,707, 2026-11-18 | Rust | HTTP load tester with TUI, external binary | ideas / optional |
| k6 | github.com/grafana/k6 | AGPL-3.0 | 32,373, 2026-11-18 | Go | scripted load tests | NOT absorbable (AGPL); ideas only |
| 0x | github.com/davidmarkclements/0x (npm `0x` 6.0.0) | MIT (npm and GitHub) | 3,550, 2025-09-30 | JS | flamegraphs | skip; use `node --cpu-prof` (built in) |
| clinic.js | github.com/clinicjs/node-clinic | MIT | 5,944, 2024-09-19 | JS | doctor, flame, bubbleprof | ideas only (stale) |
| Bencher | github.com/bencherdev/bencher | Apache-2.0 or MIT per README, "plus" dirs separate (API: NOASSERTION; not independently confirmed) | 933, 2026-11-21 | Rust | regression thresholds in CI | ideas only |
| Node SEA | nodejs.org/api/single-executable-applications | Node licence | n/a | C++ | single binary from the pinned Node; CJS-only on v24; stability 1.1 | depend |
| esbuild | github.com/evanw/esbuild | MIT | 40,163, 2026-08-09 | Go | bundle ESM TS to one CJS file for SEA | depend (dev) |
| yao-pkg/pkg | github.com/yao-pkg/pkg | MIT | 934, 2026-11-21 | JS | maintained pkg fork; vercel/pkg archived 2024-01-03 | fallback |
| Bun compile | github.com/oven-sh/bun | MIT (LICENSE.md: "Bun itself is MIT-licensed"), but statically links JavaScriptCore under LGPL-2; API says NOASSERTION | 96,818, 2026-11-21 | Rust | cross-target single file, bun:sqlite | ideas only |
| Deno | github.com/denoland/deno | MIT | 109,120, 2026-11-17 | Rust | `deno compile`; node:sqlite compatibility not checked | ideas only |
| better-sqlite3 | github.com/WiseLibs/better-sqlite3 | MIT | 7,558, 2026-11-14 | JS | npm 13.2.0; native build; whether the Mem0 adapter depends on it was not verified | alt backend |
| node-lru-cache | github.com/isaacs/node-lru-cache | BlueOak-1.0.0 | 5,920, 2026-09-18 | JS | LRU with TTL and size limits | depend only if licence cleared; else write 40 lines |
| piscina | github.com/piscinajs/piscina | MIT (npm; API says NOASSERTION) | 5,241, 2026-11-20 | TS | worker pool | ideas only |
| Distribution tooling: Homebrew, winget-create | Homebrew/brew (BSD-2-Clause, 50,395), microsoft/winget-create (MIT, 667) | | | | publish formulae and manifests | tooling only |

Facts from docs, not repos: `node:sqlite` is release-candidate (1.2) from v24.15.0 and v25.7.0; `DatabaseSync` takes `timeout`, `readBigInts`, `returnArrays`; a `sqlite.db.query` diagnostics channel exists; `createTagStore()` caches statements. SEA on v24: CJS only, assets via `node:sea`, same Node version for blob and binary. Whether `node:sqlite` runs inside a SEA is unverified (the SEA page is silent). No independent benchmark of node:sqlite against better-sqlite3 or bun:sqlite from 2026 was found; Bun's "3 to 6x" claim is vendor-run and the one independent write test (2024) disagrees.

## PR plans

### AB-PRF-1: plane-overhead benchmark suite and published latency budget
- goal: measure p50, p99, p99.9 of `Plane.write` (allow and deny) and `Plane.read` (explain on and off) across store sizes 100, 1,000, 10,000 and 100,000 items, three policy presets, SQLite file versus in-memory, against a bare-`node:sqlite` insert/select baseline. Publish `research/results/perf-budget.json` and a table in `docs/architecture.md`.
- absorbs: tinybench for the harness; deterministic counters (SQL statements, rows parsed per call) taken from a counting wrapper around `Db.prepare` (backend-agnostic, works on Postgres too). VERIFIED FIX: the `sqlite.db.query` diagnostics channel is in the current Node 24 docs but fired zero events on this machine's Node 24.14.0, so it cannot be the primary counter; Bencher's threshold idea as a local script.
- files: `packages/bench/src/perf/` (new), `packages/bench/scripts/run-perf.ts`, `research/scripts/perf_budget.py`, `research/configs/perf-budget.json`, `research/results/perf-budget.json` plus MANIFEST row, `Makefile` target `bench-perf`, `docs/deps.md` (tinybench row), AGENTS.md command list, log entry.
- effort: M. depends on: none.
- value: product: the first number anyone can quote for "overhead of governing a memory call"; thesis: Part I load-bearing claim that the plane is cheap enough to sit in the request path (an H-level overhead statement in the bench chapter). Gate = counters exact (statements per read at N items) and wall-time ratio to baseline within a stored tolerance; wall-time in absolute ms is reported, not gated (rule 9: numbers come from a script).
- risks: tinybench licence MIT, fine; machine noise (mitigate: fresh process per cell, report CPU and Node version, ratio gating); the seeded generator must be deterministic (rule 6).
- acceptance: `make bench-perf` regenerates `research/results/perf-budget.json` and `make test-repro` verifies its sha256 for the counter section.

### AB-PRF-2: memoised, incrementally maintained item projection (the read-path fix)
- goal: replace the double `currentItems(db)` full scan with an in-process parsed-item cache keyed by db handle, updated by `appendEvent`'s `project()` and invalidated by `PRAGMA data_version` (SQLite) or `max(seq)` (Postgres) so another process's write is seen. Add a per-scope index so `reachable` filtering reads only reachable rows. The result of `read` must be byte-identical.
- absorbs: idea of memoised projections (Eywa note, `2605.30771`); no dependency; optionally LRU if scope count is large.
- files: `packages/core/src/events.ts`, `packages/core/src/plane/read.ts`, a new `packages/core/src/projection-cache.ts`, migration adding `items(scope, status)` index (schema-adjacent: Rule 5 applies if the schema file changes, so keep it a Db migration only), tests in `packages/core/test/`, benchmark rows from AB-PRF-1.
- effort: M. VERIFIED FIX: drop the `items(scope, status)` index. The `items` table has no scope column (only id, body, store_adapter, store_key, seq) and `reachable()` also depends on grants, so an index needs a column migration and backfill and does not remove the policy filter. Ship the cache alone. Enumerate every writer of `items` (project(), rebuild(), erasure paths) so none bypasses invalidation. depends on: AB-PRF-1 (to prove the gain and to guard the read-under-lock invariants); touches load-bearing thesis code, so run `make test-invariants` including the two-handle case.
- value: read cost drops from O(all items, parsed twice) to O(reachable). Thesis: removes the scaling objection before any scale experiment (`make test-scale` already writes 26,616 rows).
- risks: the read re-reads the projection under the lock to catch concurrent erasures (the 2026 review findings cited in read.ts); a stale cache would leak erased content. The cache must be validated inside the transaction against `data_version`, never trusted across it. No licence risk.
- acceptance: `make test-invariants` passes and `make bench-perf` shows statement count and parsed-rows per read bounded by reachable items.

### AB-PRF-3: SQLite tuning profiles and a statement cache
- goal: a statement cache in `openSqlite` (SQL text to prepared statement, bounded), a `profile` option (`durable` default FULL, `balanced` NORMAL with larger `wal_autocheckpoint` and `journal_size_limit`, `bulk` for runner and replay logs), `cache_size`, `temp_store=MEMORY`, optional `mmap_size`, all reported by `engram doctor`.
- absorbs: SQLite WAL guidance; note `repo-sqlite-wal-tuning`.
- files: `packages/core/src/db/sqlite.ts`, `packages/cli/src/doctor.ts`, `docs/decisions/` (new ADR, because default durability is a choice another card could make differently), `packages/core/test/db/contract.ts` (profile cases).
- effort: S. depends on: AB-PRF-1.
- value: removes 38 repeated prepares from the write and read path; the runner's replay logs get faster. Thesis: none claimed beyond reproducibility; defaults unchanged so results stay valid.
- risks: NORMAL can drop the last commits on power loss, so the product default must stay FULL. Statement cache must be closed on `close()`; node:sqlite is release-candidate and its API may shift.
- acceptance: `make test` passes on the `Db` contract for each profile, and `make bench-perf` shows the cache's effect.

### AB-PRF-4: single-binary build of the `engram` CLI and server
- goal: `make dist` produces `dist/engram-<os>-<arch>[.exe]` containing CLI, `serve`, `mcp` and `hook`, with the built inspector UI as embedded assets, via esbuild to one CJS file and Node SEA. Smoke test: `engram doctor`, a write, read and explain on a temp folder, and the MCP handshake.
- absorbs: Node SEA, esbuild; note `repo-node-sea`. Fallback: yao-pkg/pkg.
- files: `scripts/build-sea.mjs` (new), `sea-config.json`, `packages/core/src/db/postgres.ts` (worker loaded as a bundled asset instead of a `.ts` path, per the ADR 0024 note), `packages/server/src/static.ts` (read UI from `node:sea` assets), `Makefile`, `docs/deps.md` (esbuild), a test under `packages/cli/test/`, log entry.
- effort: L. VERIFIED FIX: esbuild to CJS breaks `import.meta.url` uses (found in `packages/cli/src/main.ts`, `packages/core/src/db/postgres.ts`, `packages/core/src/policy/load.ts`; `packages/server/src/static.ts` UI_DIST also uses it), so these need define shims or asset lookups; the first step is the feasibility smoke (pi bundling, node:sqlite inside SEA). `--build-sea` is Node 25.5+, so on Node 24 the flow is `--experimental-sea-config` plus postject (MIT per npm), which needs a deps row. depends on: none for Linux or Windows builds; run AB-PRF-1 first so the binary's startup and per-call cost are reported.
- value: product: one download, no pnpm; thesis: reproducible artefact for the examiners. 
- risks: Node 24 SEA is CJS-only and stability 1.1; pi packages are ESM and may fail to bundle; `node:sqlite` inside a SEA is unverified; signing needs `signtool` or `codesign`; `useCodeCache` must be off for cross-platform builds; Windows binary is unsigned (SmartScreen warning).
- acceptance: `make dist && ./dist/engram doctor && make test-e2e DIST=1` on the built binary.

### AB-PRF-5: write-path trimming (event parse, serialisation, hashing)
- goal: avoid double serialisation in `appendEvent` (Zod `MemoryEventSchema.parse` of the whole event, then `JSON.stringify`, then `JSON.parse` on every later read), reuse the validated object, store the already stringified body once, and move per-write content hashing out of any loop. Measure first: if Zod 4 parse is below 5 percent of the write budget, drop this card.
- absorbs: none; possibly a precompiled validator (Ajv standalone) only if profiling shows Zod dominates. Not assumed.
- files: `packages/core/src/events.ts`, `packages/core/src/plane/write.ts`, `packages/core/src/content-hash.ts`, tests.
- effort: S to M, conditional (`MemoryEventSchema.parse` at events.ts line 191 and `JSON.stringify` at line 203 confirmed). Do not start unless the AB-PRF-1 profile shows parse plus stringify above 5 percent of write cost. depends on: AB-PRF-1 profile (`node --cpu-prof`) to justify.
- value: write p99 down; thesis: none beyond not regressing the invariants.
- risks: touches the schema validation path; Rule 5 forbids mixing with a schema change. Validation must not be weakened.
- acceptance: `make test-invariants` and `make bench-perf` show write p99 improved with equal event bytes.

### AB-PRF-6: HTTP and MCP end-to-end load test
- goal: autocannon (in-process, MIT) against `engram serve` loopback with a realistic read/write mix, and a stdio MCP latency probe, to publish request-level p50 and p99 beside the plane-level ones from AB-PRF-1.
- absorbs: autocannon. k6 is AGPL and excluded.
- files: `packages/bench/src/perf/http.ts`, `Makefile`, deps row, results JSON.
- effort: S. depends on: AB-PRF-1.
- value: shows what a harness user feels; thesis: the end-to-end overhead figure.
- risks: loopback numbers flatter the system; label them as such.
- acceptance: `make bench-perf HTTP=1`.

### AB-PRF-7: publishing and distribution (npm, Homebrew tap, winget)
- goal: `npm publish`-ready `@engram/cli` and `@engram/pi-package` (compiled JS, not type-stripped TS, since Node refuses stripping under `node_modules`), a Homebrew tap formula and a winget manifest pointing at the AB-PRF-4 binaries and their sha256.
- absorbs: Homebrew (BSD-2-Clause), winget-create (MIT), goreleaser's checksum and manifest idea (MIT, Go, not used as code).
- files: `packages/*/package.json` exports and `files`, `scripts/release-manifest.mjs`, `docs/release.md`.
- effort: L (VERIFIED FIX: every workspace package is `"private": true` and runs TypeScript by type stripping, so publishing needs a compile or bundle step for the whole dependency chain). depends on: AB-PRF-4.
- value: product only; no thesis claim.
- risks: public package names and trademark; npm provenance needs CI, which is nonfunctional, so release is a local `make release` step; must not publish dogfood content (rule 12).
- acceptance: `npm pack` in a clean temp dir then `npx ./engram-cli-*.tgz doctor`.

## Recommended order

1. AB-PRF-1: nothing else can be justified or checked without it, and it yields the published latency budget the thesis can cite.
2. AB-PRF-2: the read path scans and parses the entire projection twice per call; this is the one clear algorithmic cost, and it must be proven invariant-safe because read.ts re-reads under the lock to stop erased content leaking.
3. AB-PRF-4: the single binary is the most visible product deliverable; start with the SEA feasibility smoke (pi bundling to CJS, node:sqlite inside SEA) before committing to the full card.

## Decisions for the lead

- Default `synchronous` stays FULL (my recommendation), or accept NORMAL for the product? Needs an ADR.
- Is a Bun or Deno runtime allowed to ship at all, given thesis results are Node 24?
- Wall-clock budgets: ratio gates only, or absolute ms on a named reference machine?

## Unverified

- Bun, piscina, postject licences (API says NOASSERTION); 0x repository location and licence; Deno `node:sqlite` compatibility; `node:sqlite` working inside a SEA; `--build-sea` version history beyond one search excerpt; tinybench built-in p99; Bencher's statistical test and free-for-OSS terms; any 2026 benchmark of node:sqlite versus better-sqlite3 or bun:sqlite; Bun docs content (page returned 404, used search excerpts); the effect size of any proposed optimisation (nothing was measured in this repo).

## Verification (2026-11-21)

Checked, with `gh api`, `npm view` and the Node docs:
- Licences, stars and last push for 18 GitHub repos (tinybench, mitata, autocannon, oha, k6, node-clinic, bencher, esbuild, yao-pkg/pkg, bun, deno, better-sqlite3, node-lru-cache, piscina, brew, winget-create, 0x, postject): every number in the table matched the API except those corrected below. npm licences: tinybench 6.2.4 MIT, autocannon 9.0.0 MIT, esbuild 0.28.2 MIT, lru-cache 11.5.3 BlueOak-1.0.0, piscina 5.3.2 MIT, better-sqlite3 13.2.0 MIT, postject 1.0.0-alpha.6 MIT, 0x 6.0.0 MIT.
- arXiv 2605.30771 resolves to "Eywa: Provenance-Grounded Long-Term Memory for AI Agents" (Resham Joshi): correct.
- Code claims: `currentItems` called at read.ts lines 142 and 172, defined at events.ts line 239 with `ORDER BY id` plus `JSON.parse`: confirmed. 38 `.prepare(` sites in packages/core/src: confirmed. `openSqlite` sets busy_timeout and WAL only: confirmed. Files named by the plans exist (events.ts, plane/read.ts, plane/write.ts, content-hash.ts, db/sqlite.ts, cli/src/doctor.ts, server/src/static.ts, core/test/db/contract.ts); `projection-cache.ts`, `packages/bench/src/perf/` and a `bench-perf` target are new (no existing perf work found, nothing duplicated).

Corrected:
- 0x: the repo exists (davidmarkclements/0x, MIT, 3,550 stars, pushed 2025-09-30); the report said not found.
- Bun: MIT per its LICENSE.md, with LGPL-2 JavaScriptCore statically linked; still ideas only. piscina and postject are MIT per npm (the GitHub API's NOASSERTION is a detection gap). Bencher's Apache-2.0 or MIT is the README's claim only.
- The `sqlite.db.query` channel: documented, but zero events fired on Node 24.14.0 here, so counters use a `Db.prepare` wrapper (AB-PRF-1).
- AB-PRF-2's per-scope index is infeasible as written (no scope column, reachability depends on grants); removed.
- AB-PRF-4: CJS bundling breaks `import.meta.url`; Node 24 uses postject, not `--build-sea`. AB-PRF-7 effort raised from M to L (all packages private, TypeScript run directly). The better-sqlite3 "already a dep of the Mem0 adapter" claim is unverified and softened.

Refuted: none of the headline claims; the read path does scan and parse the whole projection twice per call.

Litreview notes: repo-node-sea, repo-sqlite-wal-tuning, repo-tinybench, repo-bun-compile, repo-bencher checked; no em dashes; frontmatter ids match filenames; fixed the Bun licence line, the postject licence line and the diagnostics-channel caveat.
