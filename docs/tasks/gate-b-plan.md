# Plan: Gate B engineering in six PRs

Status: proposed 2026-10-29 by the orchestrating session on the lead's instruction ("create a spec for the gate b engineering and make it so that it is entirely done with all goals achieved in 6 prs at most then execute it"). The decisions in section 3 were taken by the orchestrating session, as for the Gate A plan (`docs/tasks/gate-a-e0-e1-e2-plan.md`), and stay pending the lead's review with the ADRs it drafts (0027 to 0029, and 0030 drafted by PR 5). Six PRs at most, this one included. Each PR follows AGENTS.md and the two conventions; rule 10 (one card per PR) is set aside for them as it was for PRs #2 to #15 (`docs/log/2026-10-25-six-prs-for-the-next-cards.md`).

## 1. Where the repository stands

Verified on main `cbb9d60` (2026-10-29): `make test` 1809 passed and 14 skipped, pytest 20, `make test-invariants` 5 passed, `make test-e2e` 10 passed, CI and e2e green.

Gate B (roadmap, end of week 6) against the code:

| criterion | state at `cbb9d60` | closed by |
|---|---|---|
| both adapters pass the conformance suite | Mem0 passes (A1, A4); there is no Letta adapter (A2 open) | PR 2 |
| a policy file denies a cross-scope read on both stores with the same event recorded | `packages/adapters/test/plane/acceptance.test.ts` runs on every registered adapter (fake, Mem0, files); Letta is not registered | PR 2 |
| the event log reproduces a recorded workload's item set from events alone | core's replay tests (E1.3) on SQLite and Postgres; not run per store | PR 2 |
| GateMem probes run through the plane on the primary model | RN1 runs one probe under C5 on the fake store with a scripted model and a placeholder mapping (each speaker's own person scope, no grants); no primary model is chosen (the pre-registration names it and is backlogged) and no provider key exists on the build machine | PR 5, live half: exception (c) |
| carried (a): GateMem reference numbers within tolerance, on the ported judge, once the pre-registration leaves the backlog | judge ported in #15; conditional on the pre-registration | stays conditional |
| carried (b): the poisoning arm's benchmark chosen and dated | MPBench unreleased; MEM-INV-Bench released and checked (`packages/bench/PINS.md`) | PR 1 (decision 3), PR 6 |

Phase 1 cards (roadmap weeks 3 to 6) still open:

| card | goal | PR |
|---|---|---|
| A2 | Letta adapter over its git-backed context files | 2 |
| B3 | GateMem through the plane: principals map to scopes and grants | 5 |
| B4 | the poisoning benchmark through the plane: write and retrieval phases cross the gate | 6 |
| E8.1 | HTTP server over core, OpenAPI generated | 3 |
| E8.3 | generated TypeScript client | 3 |
| E8.2 | the rest of the CLI: every command one client call, `serve` | 3 |
| E8.4 | MCP server, stdio and streamable HTTP | 3 |
| E8.5 | inspector v0: scope lanes, timeline | 4 |
| E8.6 | explain view | 4 |

B2 (MPBench pin) is replaced by decision 3; B1's live acceptance is Gate A exception (a).

## 2. Scope

In: the nine cards above, the Gate B record, and two follow-ups the surfaces touch anyway (`docs/tasks/backlog.md`): `engram retain`, and the CLI path spellings in pi bash (review P5-20) when the store-command check moves to core.

Out: any paid or live model call; the pre-registration (backlogged); PX2, PX3 and RN2 (no gate places them; PX2 feeds the simulator, E8.9, in phase 3); phase 2 and later cards (L1, E8.7 to E8.10, E9); schema changes (the "not now" list of the Gate A plan stays for the next schema PR); authentication (decision 4 keeps the server on loopback until a card adds it).

## 3. Decisions taken

1. **Gate B engineering is done when every criterion holds on scripted and cassette models; the live halves wait for the pre-registration.** The primary model is named by the pre-registration, which the lead backlogged with the rule that nothing runs before it leaves the backlog; there is also no provider key on the build machine. So criterion 4 is met as "GateMem probes run through the plane under C5 on every store, from cassettes", and its live half becomes Gate B exception (c): one command (PR 5) runs the same probes on a named model and records a new cassette directory when the pre-registration names the primary model and the lead supplies its key. Exception (a) stays as it is. The Gate B record (PR 6) proposes "passed with exceptions (a) and (c)"; the lead declares the gate.
2. **The Letta adapter works over Letta's MemFS, its git-backed context repository, on local disk** (ADR 0028). Card A2 names "git-backed context files"; ADR 0013 named the server client (`@letta-ai/letta-client`), which needs a running Letta server and its Postgres, which means Docker or a hosted account, both excluded. MemFS is Letta Code's own memory: a git repository of Markdown files, each with YAML frontmatter (`name`, `description`), a `MEMORY.md` index per directory, every edit a commit, and local-only agents commit to a repository on the machine. Engram's items live in an `engram/` directory with its own `MEMORY.md`, outside the files Letta loads into every prompt; one commit per write and per delete; search over the adapter's own index of those files (lexical, `native_search: false`, since MemFS has no search of its own); `history` from git (`native_history: true`). Git is reached through the `git` executable; no network operation is ever run (no fetch, pull or push); no new npm dependency.
3. **The poisoning arm runs on MEM-INV-Bench** (ADR 0029), dated 2026-10-29. Gate A exception (b) orders the choice: MPBench if released, else MEM-INV-Bench, else BF1. MPBench has no release (checked 2026-10-17 and 2026-10-29); MEM-INV-Bench has code and data under MIT (checked 2026-10-29). It measures a different thing (poisoned memory driving a consequential action past an authorisation monitor, across laundering channels), which ADR 0029 states as the arm's limitation. The pre-registration already lists it under "Proposed amendments, not yet registered"; it is registered when the pre-registration leaves the backlog, and until then B4's config is a pipeline config, as RN1's is. If MPBench is released before X3 starts, the lead may add it by a decision entry and a pin PR; no experiment has started, so rule 8 allows it. BF1 stays the fallback's fallback.
4. **One HTTP contract for every surface** (ADR 0027). The server is a Hono app whose route table is the single source: each route names its method, path, request and response Zod schemas (reusing core's contracts) and a handler that calls the Plane or another core function and holds no policy logic. OpenAPI 3.1 is built from that table with Zod 4's `z.toJSONSchema` (no OpenAPI plugin to pin against Zod's version) and written to `sdk/openapi.json` by `make api`. The TypeScript client is generated from it (`openapi-typescript` for types, `openapi-fetch` at run time) into `sdk/ts/` and `packages/ui/src/api/`. The CLI and the MCP server call the client; with no server named, the client's fetch is bound to the app in process (`app.fetch`), so no command needs a running server and every command is still one client call; `--server <url>` or `ENGRAM_SERVER_URL` sends the same calls over HTTP. There is no authentication in v0, so the server listens on loopback only and refuses any other host, checks the `Host` header against loopback names (DNS rebinding), refuses a cross-origin `Origin`, accepts only `application/json` request bodies (a browser cannot send one cross-site without a preflight it will not get), sends no CORS headers, and caps body size. The actor is part of each request and is self-asserted, exactly as the CLI's `--as` is (the "CLI identity" follow-up covers both). A policy decision is a response, not an HTTP error: allow, deny and ask are 200 with the event; `InvalidCallError` is 400, `ExplainDeniedError` 403, `NotImplementedYet` 501 naming the card. `docker-compose.yml` gains no `server` or `ui` service until authentication exists; ADR 0019's amendment list says so.
5. **What the inspector shows, and as whom.** The inspector views the workspace as one actor (the viewer), named at `engram serve --as <id> --member <scope>...` and changeable in the UI. Scope lanes come from `Plane.read` as the viewer, through the client, so they pass the read filter, record a read event, and never show an item the viewer cannot read (rule 2; reading the plane's projection directly would bypass both). The timeline shows the events the viewer may see, decided in core by a pure `visibleEvents(actor, events)`: events in a scope the viewer is a member of, and events the viewer made. The explain view calls `Plane.explain` as the viewer for the viewer's own reads; another actor's read shows its event and the line that only its reader may explain it (decision D5). The filtered counts per category come from a core function that parses the read event's reason, beside the function that writes it, round-trip tested, so no surface parses the reason by hand. Snapshots and time travel wait for E8.10 (diff view).
6. **The MCP server acts with an identity fixed at launch, never chosen by the model.** `engram mcp --as <id> --member <scope>...` (stdio) or with `--http <port>` (streamable HTTP, loopback only, `Origin` checked as the MCP specification requires). Every tool call is made as that actor with source `model`, the way the pi extension labels agent tool calls (ADR 0004, decision D4); no tool parameter names an actor, a source or a provenance kind. The tools are the architecture's four, `memory_write`, `memory_read`, `memory_explain` and `memory_simulate` (501 until E8.9, returned as a tool error naming the card), with the names, descriptions and write-result wording the pi extension uses, from one definition both import without loading pi. A read renders in the shared memory-tag shape (read id, admitting rules, content escaped). ADR 0022's Claude Code hook ships as `engram hook claude-code`: a PreToolUse hook that blocks a Bash command naming a store and a file tool on a path inside a store root, and records each block as a `bypass_blocked` event through the client. The store-command check moves from `packages/pi-extension/src/bash.ts` to core (rule 1: it decides), where both surfaces call it, and gains the path spellings of P5-20 on the way.
7. **GateMem's principals map to scopes and grants from fields the agent may see** (ADR 0030, drafted by PR 5). Each principal is an actor with a person scope; GateMem's relationships and sharing permissions become memberships of shared scopes or grants, whichever expresses them without loss. The mapping reads only fields that survive hidden-field stripping (`query_type`, `expected_action`, `judge_spec` and `leak_targets` never reach it), and a test shows the mapping is unchanged when the hidden fields change. This replaces RN1's placeholder, so RN1's cassettes are re-recorded once with `make fixtures`.

## 4. The six PRs

Order: PR 1 now. PR 2, PR 3, PR 5 and PR 6's B4 part start together on main. PR 4 stacks on PR 3 and starts once PR 3's server and client are committed. Whichever of PR 2 and PR 3 merges second wires the `letta` store into the workspace opener and the CLI smoke. PR 5 adds the `letta` store to the runner once PR 2 is on main. PR 6 merges last and carries the Gate B record. At most four agents work at once. Each PR: acceptance test first, implementation, mutation checks on its critical rules, a log entry per card and per failure, ADR amendments in the amendment lists with status lines unchanged, and an independent review whose fixes are verified before merge.

### PR 1. The plan and its decisions

This file; ADRs 0027 to 0029 with their decision entries and index rows; amendments pointing at them in ADR 0013 (Letta through MemFS), ADR 0015 (the poisoning arm) and ADR 0019 (no `server` or `ui` compose service before authentication); `packages/bench/PINS.md` and `docs/tasks/backlog.md` dated with the arm's choice; a status line on each card of section 1; the stale Postgres line of the architecture's open items. Acceptance: `make lint-docs && pnpm exec vitest run scripts/test/tasks-and-decisions.test.ts`.

### PR 2. A2: the Letta adapter over MemFS, and criteria 1 to 3 on both stores

1. `packages/adapters/src/letta/`: `createLettaAdapter({ root })` over a MemFS repository. It opens an existing repository or initialises one in an empty folder (a local-only agent's repository), and refuses a folder that is neither. Items are `engram/<id>.md` with Letta's frontmatter (`name`, `description`) and Engram's item fields beside them, every field round-tripping exactly as the conformance corpus requires; `engram/MEMORY.md` lists each file with its description; the root `MEMORY.md` gets one line naming `engram/` and is otherwise left as written. One commit per write and per delete, touching only the item file and the index, with the repository's own identity (or `Engram <engram@localhost>` through the environment when none is set) and its own hooks; a failed commit restores the working tree, so a write is all or nothing. Writes are serialised in the adapter and across processes the way the files adapter's lock does it. Ids and refs are validated; symlinks, hard links and anything under `.git` are refused. `search` over the adapter's index; `history` from git, oldest first. No network operation, no new dependency; `GIT_TERMINAL_PROMPT=0`.
2. Registry entry (`lexical: true`); the conformance suite, the meta-test and the cross-store acceptance (`packages/adapters/test/plane/acceptance.test.ts`) pass with it, so criteria 1 and 2 hold on Mem0 and Letta.
3. Criterion 3 on every store: `packages/adapters/test/plane/replay-workload.test.ts` runs a recorded workload (writes, rewrites, denials, retirements, a promotion) through the real Plane on every registered adapter and checks that the item set rebuilt from the events alone (`itemsAt`) equals the projection and what the store lists.
4. "A commit per write": a test counts commits after n allowed writes and m deletes (n plus m), checks each commit's file list, and that a denied write through the plane makes no commit.
5. `engram doctor`'s letta check (now skipped): `git` on the path and a write, read and delete round trip in a temporary MemFS repository, offline.
6. ADR 0028 amendments; `docs/tasks/A2.md`; AGENTS.md if a command changes.

Acceptance: `pnpm --filter adapters exec vitest run test/conformance test/letta test/plane`. Mutation checks: the commit skipped, a frontmatter field dropped, the index not updated, a traversal id accepted, the failed-commit restore removed.

### PR 3. E8.1, E8.3, E8.2 and E8.4: the HTTP contract, its client, the CLI on it, the MCP server

Commit the server and the client first (PR 4 starts from them).

1. `packages/server/src/`: the route table and `createApp(workspace)`. Routes under `/api/v1`: write (`POST /items`), check a write (`POST /items/check`), read (`POST /read`), explain (`POST /explain/{readId}`), promote (`POST /promote`), retain (`POST /retain`), visible events (`POST /events`), the loaded policy (`GET /policy`), lint, simulate and distill (501 naming L1, E8.9 and D2), record a bypass (`POST /bypass`), the viewer named at serve (`GET /viewer`), health (`GET /health`). Errors as decision 4. The loopback, `Host`, `Origin`, content type and size rules of decision 4, each with a test. `visibleEvents` in core with a property test (a viewer never sees an event in a scope they are not a member of unless they made it).
2. The workspace opener (`openDb`, the store adapters, the policy) moves from `packages/cli/src/` to `packages/server/src/workspace.ts`, which the CLI imports.
3. `packages/server/src/openapi.ts` builds the OpenAPI document; `make api` writes `sdk/openapi.json` and generates `sdk/ts/` (a workspace package, every file written by the generator) and `packages/ui/src/api/`; `make api-check` covers all three.
4. The CLI: read, write, explain, promote, retain (new, closing the backlog item), lint and simulate are each one client call, in process unless `--server` or `ENGRAM_SERVER_URL` names one; exit codes unchanged (0 allow, 1 deny or ask, 2 usage or not implemented). `engram serve [--host 127.0.0.1] [--port] [--db] [--root] [--store] [--policy] [--as] [--member]`. `doctor` stays local. A help snapshot test; a test with a counting fetch shows one request per command.
5. `packages/mcp/`: decision 6 on `@modelcontextprotocol/sdk`; `engram mcp`; the shared tool definitions; `engram hook claude-code` and the store-command check moved to core with P5-20's spellings. Fixtures: a Claude Code project (`.mcp.json`, the hook in `.claude/settings.json`) and a Codex `config.toml` under `fixtures/harness/`.
6. `make test-e2e` gains the MCP handshakes from both fixtures (initialize, list tools, write, read, explain on that read).
7. ADR 0027 amendments; ADR 0022 amendment (the hook ships), ADR 0014 amendment (the check lives in core, P5-20); `docs/deps.md` rows; AGENTS.md and CLAUDE.md command lines (`engram serve`, `engram mcp`, `engram retain`, `engram hook`); the architecture's Interfaces.

Acceptance: `pnpm --filter server test` (contract tests hit every route against the fake adapter and every route is in the OpenAPI document), `make api-check`, `pnpm --filter cli test`, `pnpm --filter mcp test` (an MCP client runs explain on a fixture read over the in-memory, stdio and HTTP transports), `make test-e2e`. Mutation checks: the `Host` check, the `Origin` check, the content-type rule, `visibleEvents`' membership rule, the MCP source label (a model-sourced write must not land as user), a store command the hook must block.

### PR 4. E8.5 and E8.6: the inspector and its explain view

Stacks on PR 3.

1. `packages/ui/`: Vite and React, built by `make ui` into `packages/ui/dist`, served by `engram serve` at `/` beside the API; no network fetch other than the API (no fonts or scripts from a CDN). Views per decision 5: a viewer picker, scope lanes (items with class, status, provenance kind, validity), a timeline (op, decision, reason, policy id, filters by scope, op and decision, an event's detail), and the explain view for a read (returned items with rank, score components, admitting rule, grants used, validity; the filtered counts per category).
2. Core: the read-reason parser of decision 5, beside its writer, with a round-trip property test; the explain route returns the counts with the explanations.
3. Tests: the UI's view logic under vitest; Playwright (the `playwright` library driven from vitest in `test/e2e/`) opens a fixture workspace built at test time from `fixtures/workspaces/inspector/` (policy, workload, fixed ids and times) and asserts the lanes, the timeline's event count, and that the explain view's filtered count equals the read event's. Chromium is installed by `pnpm exec playwright install chromium`; locally a missing browser skips with the reason printed, under CI it fails. The e2e workflow installs it.
4. ADR 0027 amendments (the stack); `docs/deps.md` rows; AGENTS.md `make ui`.

Acceptance: `make test-e2e` (Playwright opens the fixture workspace; the filtered count matches the event) and `pnpm --filter ui test`. Mutation checks: lanes read without the plane (a test sees no read event and fails), the timeline ignoring `visibleEvents`, the counts parser off by a category.

### PR 5. B3: GateMem through the plane

1. `packages/bench/src/gatemem/plane.ts`: the mapping of decision 7 and ADR 0030 (drafted here): actors, scopes, grants, each turn's item and its provenance kind, from stripped fields only; a test that changing hidden fields changes nothing.
2. The runner's probe uses it in place of RN1's placeholder; the run config admits the stores `fake`, `mem0` and (once PR 2 is on main) `letta`.
3. `research/configs/b3-gatemem-plane.json` (a pipeline config): one access-control, one forgetting and one utility checkpoint under C5 on every store, scripted model, cassettes recorded by `make fixtures`; RN1's cassettes re-recorded once.
4. A cross-principal read the mapping forbids is denied with the same event on every store.
5. The live half of criterion 4 (exception (c)): `make run CONFIG=research/configs/b3-gatemem-plane.json MODEL=<provider/model> LIVE=1` records into a new, uncommitted cassette directory; it refuses under `ENGRAM_OFFLINE`, never writes into committed cassettes, and is tested with pi-ai's faux provider standing in for a live one.
6. ADR 0030; `docs/tasks/B3.md`.

Acceptance: `ENGRAM_OFFLINE=1 make run CONFIG=research/configs/b3-gatemem-plane.json` run twice (the second reports zero new model calls; the output holds each probe's write and read events per store) and `pnpm --filter bench test`, `pnpm --filter runner test`. Mutation checks: a hidden field read by the mapping, a grant dropped, the live guard removed.

### PR 6. B4 on MEM-INV-Bench, and the Gate B record

1. Vendor a fixture subset of MEM-INV-Bench at `cf3c9a4` (and the Hugging Face revision in PINS.md): about 20 attack cases across the laundering channels and some benign ones, with `UPSTREAM-LICENSE`, a manifest of hashes checked by `engram doctor`'s pins check, by a script under `packages/bench/scripts/` (`make fixtures` regenerates it).
2. `packages/bench/src/mem-inv-bench/`: loader, hidden-field stripping (attack labels and expected outcomes never reach the plane or the model), the mapping of origin channels to provenance kinds (recorded in ADR 0029's amendments), the write phase through `Plane.write` and the retrieval phase through `Plane.read` at action time, and the benchmark's rule-based outcome scoring ported for the subset with golden outcomes.
3. The runner: one attack as a pi SDK session under C5 (and C2 for contrast), `research/configs/b4-mem-inv-probe.json`, cassettes by `make fixtures`.
4. The Gate B record (orchestrator, after PRs 2 to 5 merge): a `milestone` entry with the four criteria, their evidence and exceptions (a) and (c); card statuses; this plan's status; `docs/tasks/backlog.md`.

Acceptance: `ENGRAM_OFFLINE=1 make run CONFIG=research/configs/b4-mem-inv-probe.json` run twice (zero new calls on the second; events show the poisoned write's decision and the action-time read) and `pnpm --filter bench test`. Mutation checks: a hidden label reaching the prompt, the channel-to-kind mapping, the scorer's attack-success rule.

## 5. Human steps left after the plan

- Exception (c): when the pre-registration names the primary model, the lead runs PR 5's live command with its key.
- Exception (a): GateMem's reference numbers, when the pre-registration leaves the backlog.
- The MPBench request (`docs/research/mpbench-request.md`), if the lead still wants it.
- Dogfood counts in `docs/dogfood.md`, one row per member.
- The ADR review session, now 0002 to 0030.

## 6. What this plan does not do

- No paid or live model call, no pre-registration work, no experiment.
- No authentication, no deployment image; the server stays on loopback.
- PX2, PX3, RN2; L1 and the lints (`engram lint` keeps returning 501 naming L1); E8.9 (`simulate` the same); E8.7 to E8.10; E9.
- Adoption of Letta's own memory files (`persona.md` and the like) into the plane: a follow-up, as A3 did for Claude Code memory.
- Schema changes.
