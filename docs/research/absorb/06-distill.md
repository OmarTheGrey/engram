# 06-distill: procedural memory and skill learning (prefix AB-DIS)

## Executive summary

Distill is the least built product: `packages/core/src/distill.ts` holds only the `Distiller` interface, `/distill` returns 501, and cards D1 to D4 are open. The best absorption is not a heavy dependency but a format and a harness. (1) The Agent Skills specification (Apache-2.0, `SKILL.md`) maps onto `ProceduralContent` `{body, tools}` only partly (the item has no `name` or `description`; the body or a derived slug must supply them, and `tools` maps to `allowed-tools`), and pi implements it, so Engram can export active procedures that pi and Claude Code load, and import existing skills as governed candidates. Malicious-skill measurement (USENIX Security 2026, 157 confirmed of 98,380) is the reason import must be gated. (2) AWM's code is Apache-2.0 but small and Python; ADR 0012 already fixes a TypeScript port of its prompt. (3) tau2-bench (MIT) takes `--agent-llm-args` and passes them to `litellm.completion`, so a loopback proxy by ADR 0036 should make it replayable, untested. The pre-registration pins tau2 v1.0.1, while v2.0.0 (2026-10-20) is not comparable, so the pin stands. Net: Distill can ship end to end with no new runtime dependency except possibly a YAML parser Engram already has (`yaml` 2.9.1).

## Landscape

Stars and dates are from `gh api` on 2026-11-21 unless marked.

| name | URL | licence | stars, last push | lang | what it gives us | mode |
|---|---|---|---|---|---|---|
| Agent Skills spec | github.com/agentskills/agentskills | Apache-2.0 | 27,491; 2026-11-04 | Python/MDX | `SKILL.md` format, `skills-ref` validator (Python, in the Apache-2.0 repo) | port rules (format); validator run from `research/` or e2e via uv, not from vitest |
| anthropics/skills | github.com/anthropics/skills | none reported by gh; pdf and skill-creator folders Apache-2.0, others unchecked | 198,205; 2026-11-16 | Python | 19 skill folders, import fixtures, skill-creator eval ideas | ideas, fixtures only after per-skill licence check |
| vercel-labs/skills | github.com/vercel-labs/skills | MIT | 40,276; 2026-11-17 | TypeScript | `npx skills` installer across agents; directory conventions per harness | ideas (read its agent-path table); depend only if import-by-URL is wanted |
| AWM | github.com/zorazrw/agent-workflow-memory | Apache-2.0 | 487; 2025-12-22 | Python | induction prompt (App. A.1), rule-based induction | port (ADR 0012) |
| Trace2Skill | arXiv 2603.25158 | n/a, no code seen | n/a | n/a | parallel patch-then-merge skill induction | ideas, needs prereg amendment |
| Voyager | github.com/MineDojo/Voyager | MIT | 7,337; 2024-04-03 | JS/Python | verified-run storage, skill retrieval by description embedding | ideas (existing note) |
| ExpeL | github.com/LeapLabTHU/ExpeL | Apache-2.0 | 252; 2024-12-20 | Python | insight extraction with add/edit/remove/agree votes | ideas: vote ops map to promote and retire |
| SkillWeaver | github.com/OSU-NLP-Group/SkillWeaver | MIT | 162; 2025-04-14 | Python | skills as code, "verified" = runs | ideas (existing note) |
| ReasoningBank | github.com/google-research/reasoning-bank | Apache-2.0 | 646; 2026-08-05 | Python | strategy memory from failures | ideas, out of v1 (ADR 0012) |
| DSPy | github.com/stanfordnlp/dspy | MIT | 39,163; 2026-11-19 | Python | prompt optimizers (MIPROv2, GEPA) with a metric | research-only, to tune the induction prompt later; not absorbed |
| TextGrad | github.com/zou-group/textgrad | MIT | 3,801; 2025-07-25 | Python | textual-gradient prompt edits | ideas only, stale |
| Agent-R | github.com/ByteDance-Seed/Agent-R | Apache-2.0, archived | 175; 2025-10-20 | Python | trains reflection by splicing failed to good trajectories; needs training | ideas only, not applicable |
| AutoManual | arXiv 2405.16247 (NeurIPS 2024) | repo not located | n/a | n/a | planner, builder, formulator roles producing a Markdown manual | ideas (not read beyond search summary) |
| Agent KB | arXiv 2507.06229 | repo not located | n/a | n/a | cross-framework experience sharing | ideas, not read in depth |
| tau2-bench | github.com/sierra-research/tau2-bench | MIT | 2,495; 2026-11-21 | Python | the H5 task set and deterministic reward | drive as external harness |
| OpenAI Agents SDK | github.com/openai/openai-agents-js, -python | MIT | 4,031 and 30,793 | TS, Python | span traces with a processor hook | optional second session source |

New notes (in `.claude/worktrees/research/docs/readings/litreview/`): `repo-agent-skills-spec.md`, `2603.25158-trace2skill.md`, `2602.06547-malicious-agent-skills.md`, `repo-tau2-bench-harness.md`, `repo-openai-agents-tracing.md`. Already in the litreview, not duplicated: AWM, Voyager, SkillWeaver, ReasoningBank, SkillGuard, Library Drift, SKILL.nb, MSCE, Workflow-to-Skill, tau2 paper.

Facts that shape the plans:
- Skill frontmatter fields (spec, read in full): `name` (at most 64, `a-z0-9-`, equals the directory), `description` (at most 1024), `license`, `compatibility`, `metadata` (string map), `allowed-tools`. Pi implements the spec (from search summary of pi 1.5.2 docs; the pinned 1.3.0 docs were not read).
- tau2 `generate` forwards `llm_args` to `litellm.completion`; v1.0.1 has an optional LiteLLM cache that must be off.
- Not verified: Claude Code's exact skill loading rules, pi 1.3.0's discovery paths, AWM's file layout (the README gives no prompt filename), OpenAI span payloads.

## Answers to the key questions

- Can Engram export admitted procedures as Agent Skills that Claude Code and pi load? Yes in principle: the item shape matches. Export is a pure function in core plus a writer in the CLI. The proof is a test that loads the output with `skills-ref` rules and then with pi's loader in a pi SDK session (the runner already creates them). Claude Code loading should be checked by hand once, not asserted in CI.
- Can it import existing skills under governance? Yes: parse to a candidate, source `document` (or `user` when the member imports their own), scan with deterministic lints, never active without replay `k` of `n` (ADR 0011, 0026). Scripts and `assets/` are not stored in `ProceduralContent`, so the importer must either refuse skills with `scripts/` or hold them as hashed references in a new field, which is a schema change (rule 5, its own PR).

## PR plans

All TypeScript unless stated. Core stays free of I/O and model calls (rules 1, 4).

### AB-DIS-1: Skill format in core (pure export and parse)
- goal: `toSkillMd(item)` and `parseSkillMd(text)` in core, with name, description and `allowed-tools` validation per the spec.
- absorbs: Agent Skills specification (rules ported, not code).
- files: `packages/core/src/distill/skill-format.ts`, `packages/core/test/unit/distill/skill-format.test.ts`, `fixtures/skills/` (valid and invalid examples), `docs/deps.md` only if a validator is added.
- effort: S
- depends on: nothing (uses existing `yaml` dependency).
- value: product, the portable form of every procedure; thesis, an interoperability claim for Distill with a conformance test.
- risks: `allowed-tools` syntax differs by harness; lossy round trip of the tool list; the spec's name-equals-directory rule versus item ids (use a slug plus short hash).
- acceptance: `make test-one T=packages/core/test/unit/distill/skill-format.test.ts` (round trip property test under fast-check; fixtures carry expected outputs generated once by `skills-ref` through a `research/` uv script, since vitest cannot run the Python validator).

### AB-DIS-2: Agent Skills export and import with governance
- goal: `engram skills export --scope <s> --out <dir>` writes only active procedural items the actor may read; `engram skills import <dir|file>` writes candidates through `Plane.write`; the pi package gains an `engram.skill` provenance tag.
- absorbs: Agent Skills spec; malicious-skills study (2602.06547) for scan rules; vercel-labs/skills for per-harness install paths (ideas).
- files: `packages/core/src/lint/det.ts` plus `lint.ts` (new lint ids in `DETERMINISTIC_LINT_IDS`; lints run only under C6 per `lint.ts`, so the import scan must also run in the write gate in `policy/evaluate.ts`, or a poisoned import is not blocked under C5) (deterministic lints: hide-from-user phrases, remote fetch and execute, credential paths, undeclared scripts, oversize body), `packages/cli/src/skills.ts`, `packages/server` route `/skills/export` and `/skills/import`, `packages/mcp` tool, `docs/decisions/` ADR for the item-to-directory mapping, `fixtures/faults/skills/`.
- effort: M
- depends on: AB-DIS-1; schema PR first if scripts or assets must be stored (AGENTS.md rule 5).
- value: product, the answer to "does it work with Claude Code and pi"; thesis, an import-poisoning fault class for H3 beside the existing ones.
- risks: exporting an item moves it out of the plane's read filter, so the export must run as a read by a named actor with an event, and the exported directory is ungoverned afterwards (state that). Scanner precision is contested (2603.16572), so report precision. anthropics/skills licences are mixed, so use only Apache-2.0 folders as fixtures.
- acceptance: `make test-e2e` extended: export, load in a pi SDK session, import a poisoned skill, assert it is a denied or candidate-only write with a reason.

### AB-DIS-3: Induction pipeline (AWM port), card D1 and D2
- goal: session recorder and the AWM induction over pi session JSONL, as `Distiller.distill`, producing candidate procedural items with trigger, steps and tool allowlist; abandoned branches and `branch_summary` entries as negative evidence.
- absorbs: AWM (Apache-2.0): App. A.1 prompt vendored verbatim with attribution, the rule-based induction (App. B) as the no-model baseline. The prompt files exist in the AWM repo (`webarena/induce_prompt.py`, `induce_rule.py`, `webarena/prompt/instruction.txt` and `one_shot.txt`, same under `mind2web`), but they are written for web tasks, so "verbatim" needs a stated adaptation for tau2 and coding sessions.
- files: `packages/core/src/distill/{induce,session-tree,prompt}.ts` (core takes an injected `ModelCall`), `packages/core/src/distill.ts` (extend `DistillMethod` with `awm-rule`), `packages/pi-extension` session reader (JSONL to `Session`), `fixtures/sessions/` (50 recorded sessions per D1), server `/distill` replaced 501, `docs/deps.md` untouched.
- effort: L
- depends on: D1 (recorder) is part of this PR; E2.3 merged.
- value: product, Distill works at all; thesis, the induction arm of H5, with rule-based induction as a free control (AWM Table 5 reports equal scores).
- risks: Apache-2.0 attribution; no ground-truth success label on coding sessions (AWM's evaluator has no false-positive handling); an induced workflow must not embed secrets from sessions (run the existing write gate and the secrets lint on candidates).
- acceptance: `make test-one T=packages/core/test/unit/distill/induce.test.ts` (scripted model, golden candidates for the fixture sessions), and `make test` replays with zero new calls.

### AB-DIS-4: Replay validator over pi session trees, cards D3 and D4
- goal: for each candidate, re-run the originating tasks (and held-out tasks) with the candidate installed as a skill, `n` times seeded; record `{k, n}` and promote through `Plane.promote` at `replay_k` of `replay_n`; periodic revalidation retires on a drop below a floor after a minimum trial count, or on a changed environment-assumption list.
- absorbs: SKILL.nb (Wilson bounds, rollback), Library Drift (trial floor, cap of 50 active), SkillGuard (contract list), all existing notes; tau2's database-hash reward as the oracle.
- files: `packages/core/src/distill/{validate,drift}.ts` (pure decision on counts plus a `Replayer` interface), `packages/runner/src/validate-procedures.ts` (pi SDK sessions via the cassette-backed model), `packages/core/src/policy/promotion.ts` (already there), `research/configs/h5-validate.json`, schema PR for the smoothed success rate and assumptions list if D4 needs them.
- effort: L
- depends on: AB-DIS-3; E2.5 merged.
- value: product, the gate that makes Distill governed; thesis, H5's C5 condition and the 4-of-5 threshold's justification (Wilson bounds 0.56 failure at 4 of 5 per ADR 0011).
- risks: validation cost (n replays per candidate times seeds); replay on the same tasks it was induced from is optimistic, so held-out tasks must be separated in the fixture; "passes" must mean outcome, not completion (SkillWeaver's trap).
- acceptance: `make test-invariants` extended (a failing candidate stays candidate, a passing one becomes active, a changed assumption retires) and `make run CONFIG=research/configs/h5-validate-fixture.json` replays from committed cassettes.

### AB-DIS-5: tau2 harness integration through the cassette proxy
- goal: run tau2 v1.0.1 with Engram memory conditions C1, C2, C5 offline: its agent and user-simulator calls go to the loopback proxy of ADR 0036, with cache key including role, task, trial and seed.
- absorbs: tau2-bench (MIT) driven as an external process; vcrpy and LiteLLM cache ideas (existing note repo-llm-cassette-proxies).
- files: `packages/model/src/proxy.ts` (the proxy, owned by ADR 0036's card), `packages/bench/src/tau2/` (runner wrapper, pin in `PINS.md`), `research/tau2/engram_agent.py` (a `HalfDuplexAgent` subclass registered with `registry.register_agent_factory`, calling Engram's HTTP API), `research/configs/h5-tau2.json` (refuses any `api_base` that is not the proxy), `research/scripts/h5_tau2.py`, `docs/deps.md` (tau2 as a pinned Python tool, uv).
- effort: L
- depends on: ADR 0036's proxy card; AB-DIS-3 and AB-DIS-4 for conditions beyond C1.
- value: product, none; thesis, H5's primary dataset, and a replayable run that examiners can reproduce.
- risks: the `api_base` route and seed passthrough are untested; second runtime (Python 3.12 or 3.13 under uv) in CI; LiteLLM's own cache must be disabled; v1.0.1 versus v2.0.0 (pin v1.0.1, state that v2 is not comparable); the user simulator also needs cassettes, doubling the size of the deposit; the proxy cannot see tau2's tool execution, so the DB-hash reward must come from tau2's own saved results.
- acceptance: `make run CONFIG=research/configs/h5-tau2.json COUNT=1` prints sessions per condition, then a two-task smoke replays from cassettes with a miss as an error.

### AB-DIS-6: Skill lifecycle surfaces (inspector, pi package, MCP)
- goal: a procedures lane in the inspector (candidate, active, retired, replay `k` of `n`, why), a pi `/engram skills` command, and an MCP `skill_list` tool so Claude Code can load an active skill by calling Engram.
- absorbs: nothing external; uses AB-DIS-1 and the Agent Skills progressive-disclosure pattern (name and description first, body on demand).
- files: `packages/ui/src`, `packages/pi-extension/src` (a new command registration; the package has no commands module today), `packages/mcp/src`, `packages/pi-package/skills/`.
- effort: M
- depends on: AB-DIS-2, AB-DIS-4.
- value: product, the demo for Friday; thesis, none.
- risks: serving a skill through MCP is a read and needs an event and an explanation like any read.
- acceptance: `make test-e2e` (inspector screen on `fixtures/workspaces/` with a procedures fixture).

### AB-DIS-7 (optional): Trace2Skill-style merge as a second induction method
- goal: patch-and-merge induction behind the `DistillMethod` union, off by default.
- absorbs: Trace2Skill (ideas, no code found).
- files: `packages/core/src/distill/merge.ts`, a pre-registration amendment in `docs/research/preregistration.md`.
- effort: M
- depends on: AB-DIS-3; a reviewed amendment before any run (AGENTS.md, "What not to do").
- value: thesis, a stronger induction arm if AWM is flat on pi sessions; product, fewer duplicate skills.
- risks: work-in-progress preprint without code; scope creep before Gate C.
- acceptance: `make test-one T=packages/core/test/unit/distill/merge.test.ts`.

## Recommended order

1. AB-DIS-1 then AB-DIS-2: small, no model, no new runtime, answers the lead's two questions, and gives Distill a visible output before the induction work lands.
2. AB-DIS-3: Distill does nothing without induction, and it is already fixed by ADR 0012 and D1 to D2, so it is the shortest path to H5 data.
3. AB-DIS-4: the replay gate is the governance claim of Distill; AB-DIS-5 follows once ADR 0036's proxy exists.

## Caveats

- The `api_base` routing, tau2 seed passthrough and Claude Code and pi 1.3.0 skill loading are inferred from code and summaries, not run.
- Agent Skills in the Wild (2601.10338) and the scanner critique (2603.16572) were seen only in search summaries.
- No Docker anywhere in these plans; tau2 runs under uv.

## Verification (2026-11-21)

Checked with `gh api` and the arXiv abs pages, and against the repo.

Repos: all 14 licences, push dates and star counts match, except anthropics/skills (198,205 stars, not 198,201; `gh` reports no licence; 19 skill folders, not 18) and tau2-bench (2,495, not 2,494). Agent-R is archived (stated). tau2 tags v1.0.1 and v2.0.0 exist. `skills-ref` exists in agentskills/agentskills (repo Apache-2.0). AWM prompt files exist (`induce_prompt.py`, `induce_rule.py`, `prompt/instruction.txt`, `one_shot.txt`) but target web tasks.

Papers: 2603.25158 (Trace2Skill), 2602.06547 (Do Not Mention This to the User), 2405.16247 (AutoManual), 2507.06229 (Agent KB), 2601.10338 (Agent Skills in the Wild) and 2603.16572 (Context Matters, scanner analysis) all resolve to the claimed titles. The report's "scanner precision is contested (2603.16572)" is a search-summary claim only.

Corrected: star counts above; the claim that `ProceduralContent` matches a skill almost field for field (no name or description in the item); AB-DIS-1 acceptance (skills-ref is Python and cannot run in vitest); AB-DIS-2 (lints run only under C6, so the import scan must sit in the write gate; effort is closer to L with server, MCP, CLI and `make api` regeneration); AB-DIS-6 path (pi-extension has no commands module).

Refuted or flagged: AB-DIS-4's "core decision on counts" is partly built (`policy/promotion.ts` already meets `replay_k` of `replay_n`; `lint.ts` already names `replay-drift` and `environment-changed` triggers but no implementation exists), so only the drift decision, retirement and runner replay are new. AB-DIS-5 overlaps the "harness card" the lead asked for (decision 30) and X11, and depends on the ADR 0036 proxy, which does not exist yet in `packages/model/src`. AB-DIS-3's 50 tau2 sessions cannot be recorded for real without a tau2 harness; only scripted fixtures are possible before AB-DIS-5. MCP tools are named `memory_*`, not `skill_*`.

Notes: five notes checked, frontmatter ids and titles fine, no em dashes; tau2 note star count fixed.
