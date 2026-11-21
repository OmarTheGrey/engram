# 18a Approval workflow and shadow-memory discovery (gap-filling, AB-GAP1)

## Executive summary

Buyer gap 7 (approval workflow for sensitive writes with an approver record, as in Credal and Purview review queues) and gap 9 (shadow-memory discovery) had no master PR. Engram already holds most of the machinery for gap 7. `Status` has `candidate`, `promotion.ts` has a `review` rule (`<policy>/promotion/review`, `engram/promote/reviewer`), and `plane/promote.ts` already appends a `gate` event with decision `ask` when a request waits for a reviewer (the code comment says "the request waits in the review queue (E8.8)"). The eviction path also returns `ask` under `manual` eviction. What is missing is a first-class, derivable queue (pending, approved, denied, expired, escalated), approver identity and reason on the decision event, expiry and escalation, routing by scope owner, and surfaces (MCP, CLI, inspector). Minimal design: no new item status and no new table. A request is the `gate/ask` event; its resolution is a later `promote` (allow or deny) event carrying `request_id`, so the queue is a pure projection over the log. Gap 9 is a read-only detector (a pure classifier of paths and file heads in core, the filesystem walk in the CLI) that feeds `engram doctor` and the Claude Code hook. Nothing here calls a model, and no dependency is added.

## Landscape

Stars and dates were verified with `gh api` on 2026-11-21 where marked. Everything else is not verified.

| name | URL | licence | stars / last push | language | gives us | mode |
|---|---|---|---|---|---|---|
| LangGraph interrupts | github.com/langchain-ai/langgraph | MIT | 45,222 / 2026-11-20 (verified) | Python, JS | `interrupt()` pause with a payload, resume with a decision, keyed by checkpoint. Pattern: request id plus resume value | ideas only (our log is the checkpoint) |
| Temporal signals and updates | github.com/temporalio/sdk-typescript | MIT | 951 / 2026-11-21 (verified) | TypeScript | Signal as external decision, a timer racing the signal for expiry, a second timer for escalation | ideas only; a server would be required |
| Cedar | github.com/cedar-policy/cedar | Apache-2.0 | 1,890 / 2026-11-20 (verified) | Rust, WASM | No native obligations; the usual pattern is permit plus an annotation the caller enforces. Aligns with MP-13 | port the annotation idea into an `approval` policy field |
| GitHub CODEOWNERS | docs.github.com | docs are CC-BY-4.0 (verified for the docs repo) | not applicable | file format | Last-match-wins path to owner routing, teams as owners, required review | port the format idea with our own parser |
| Microsoft Purview review queues | learn.microsoft.com | proprietary | not applicable | n/a | Reviewer assignment, disposition review, approver record retained | ideas only |
| Credal approvals | credal.ai | proprietary | not applicable | n/a | Approvals on agent actions, consolidated audit (marketing claims unverified) | ideas only |
| Prompt Security shadow AI | prompt.security | proprietary | not applicable | n/a | Discovery of unsanctioned AI use | ideas only |
| Claude Code memory locations | docs.anthropic.com (memory) | docs | not applicable | n/a | Project and user `CLAUDE.md`, `~/.claude/projects/<slug>/memory/`; verify paths on the official page before coding | detector rules, cited |
| Codex memory files | developers.openai.com/codex | docs | not applicable | n/a | `AGENTS.md`, `~/.codex/`; unverified, verify at implementation (ties to D8) | detector rules |
| Cursor rules and memories | cursor.com/docs | docs | not applicable | n/a | `.cursor/rules`, `.cursorrules`, Memories storage; paths unverified | detector rules, flagged unverified |

Nothing needs a dependency, so no `docs/deps.md` rows. All patterns are re-implemented as small pure functions.

## Minimal design (gap 7)

1. Request: a write or promote that policy answers `ask` (policy field `approval: { scope_glob, approvers, expires_after, escalate_to, escalate_after }`) appends a `gate` event, decision `ask`, with `reason` and `policy_id`. The candidate item already exists with status `candidate` and is unreadable by others under the existing read matrix. The request id is that event's id.
2. Decision: `Plane.approve(request_id, actor, { decision, reason })` is a promote through the existing evaluator with `review: true`. The actor must be in the resolved approver set (`engram/promote/reviewer` already denies others). The event records approver in `actor`, the reason, and `request_id` (an additive optional field, schema PR per rule 5). Self-approval is refused by a new deterministic rule (`engram/approval/self`).
3. Expiry and escalation are pure functions of log time: `pendingRequests(events, now)` returns pending, expired (past `expires_after`; the candidate is retired with a reasoned retire event on the next `retain` sweep) and escalated (past `escalate_after`: the approver set widens to `escalate_to`). No daemon: Temporal-style timers become a sweep under the injected clock, so tests stay deterministic.
4. Routing: CODEOWNERS-style ordered rules, last match wins, scope path to approver list (person, role members or team).
5. Surfaces: MCP tools `approval_list` and `approval_decide` (model-sourced actors cannot approve); CLI `engram approvals list|show|approve|deny`; server routes with the generated client via `make api`; an inspector queue screen showing evidence, the diff against active items and the explain trace.

## Detector design (gap 9)

Core: `classifyHarnessMemory(path, head, home)` returns `{ harness, kind, governed }` from a data table of known locations (Claude Code, Codex, Cursor; Windsurf and Gemini CLI as unverified rows). The CLI command `engram discover [--root] [--home]` walks bounded directories, compares against configured store roots and reports ungoverned files with size and mtime. It prints counts and paths only, never bodies (rule 12). Feeds: `engram doctor` gets one check, "harness memory outside the plane" (warn, never fail). `engram hook claude-code` gets `--discovered <file>`, so a Read or Edit of a discovered file is recorded (ADR 0022 says the hook cannot govern what Claude Code already holds in context, so this is visibility, not enforcement). Honest limit: discovery shows existence, not use.

## PR plans

**AB-GAP1-1 Approval request id and policy `approval` block (schema PR)**
- goal: optional `request_id` on events, an `approval` block in the policy schema, the migration; nothing else.
- absorbs: CODEOWNERS format idea, Cedar annotation idea.
- files: `packages/core/src/schema.ts`, migration, `sdk/` and `research/engram_types` via `make api`, fixtures.
- effort: S. depends on: MP-14 (alone, rule 5).
- value: product: prerequisite for the queue. thesis: none directly.
- risks: touches load-bearing core; keep fields optional so Part I logs replay byte-identical.
- acceptance: `make api-check && make test-one T=packages/core/test/schema.test.ts`.

**AB-GAP1-2 Approval projection and `Plane.approve`**
- goal: `pendingRequests`, routing, self-approval and approver checks, expiry and escalation under the injected clock; decisions logged with approver and reason.
- absorbs: LangGraph interrupt and resume shape, Temporal timer-race semantics (ideas).
- files: `packages/core/src/policy/approval.ts`, `packages/core/src/plane/approve.ts`, `plane.ts`, `oracle.ts`, tests.
- effort: M. depends on: AB-GAP1-1.
- value: product: Credal and Purview parity with an auditable approver record. thesis: a new invariant candidate (no candidate becomes active without an allow event by a named approver).
- risks: oracle changes need `make test-invariants` green; the expiry sweep must run inside the write queue.
- acceptance: `make test-invariants` plus a new `approval.test.ts` (expiry, escalation, self-approval, wrong approver).

**AB-GAP1-3 Approvals on CLI, server and MCP**
- goal: `engram approvals ...`, server routes, MCP `approval_list` and `approval_decide`.
- files: `packages/cli/src/commands.ts`, `packages/server`, `packages/mcp/src/server.ts`, regenerated `sdk/`.
- effort: M. depends on: AB-GAP1-2.
- value: product: usable from Claude Code and Codex. thesis: extends the H4 surface.
- risks: the MCP surface is H4-pinned; add tools, never alter existing ones (see D4).
- acceptance: `make test-e2e` with a CLI smoke: write asks, approve, read shows the item.

**AB-GAP1-4 Inspector approval queue screen**
- goal: queue list, evidence, explain trace, approve and deny with reason; the viewer is the approver.
- files: `packages/ui/src` (not `src/api`), a playwright spec on `fixtures/workspaces/inspector`.
- effort: M. depends on: AB-GAP1-3.
- value: product: the visible Purview-like demo. thesis: a figure for the chapter.
- risks: loopback only, no authentication yet (identity is `--as`); say so in the log.
- acceptance: `make test-e2e` inspector spec for the approvals screen.

**AB-GAP1-5 Harness memory classifier and `engram discover`**
- goal: pure classifier in core, bounded walk in the CLI, counts-only output.
- absorbs: Claude Code, Codex and Cursor memory-location documentation, paths verified at implementation.
- files: `packages/core/src/discover.ts`, `packages/cli/src/discover.ts`, `commands.ts`, fake-home fixtures in `fixtures/harness/`.
- effort: M. depends on: none.
- value: product: closes gap 9, a security-buyer demo. thesis: grounds the bypass-surface section.
- risks: vendors rename paths, so the table is data with a doc link and a last-verified date; privacy (read a bounded head at most, never print it).
- acceptance: `make test-one T=packages/core/test/discover.test.ts` on the fixture home.

**AB-GAP1-6 Doctor check and hook feed for discovered memories**
- goal: doctor warns on ungoverned harness memory; the hook records access to discovered files.
- files: `packages/cli/src/doctor.ts`, `packages/mcp/src/hook.ts`, `packages/cli/src/hook.ts`, tests.
- effort: S. depends on: AB-GAP1-5.
- value: product: a continuous coverage statement. thesis: measures bypass coverage.
- risks: hook latency (read a precomputed file, no walk); needs an ADR 0022 amendment note.
- acceptance: `make test-e2e` hook step plus a doctor test on the fixture home.

## Recommended order

1. AB-GAP1-5: independent, read-only, no core behaviour change, and answers a distinct buyer gap.
2. AB-GAP1-1 then AB-GAP1-2: a small schema PR, then an evaluator that reuses existing promotion code, so the largest buyer gap closes with little new policy surface.
3. AB-GAP1-3: makes the queue usable from the harnesses; the inspector (4) and doctor feed (6) follow.
