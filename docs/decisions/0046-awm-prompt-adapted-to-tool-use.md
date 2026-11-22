# ADR 0046: Agent Workflow Memory's induction prompt is adapted to tool-use sessions, not vendored verbatim

Status: proposed, 2026-11-22
Deciders: drafted by card D2 of the absorb plan; for the lead's acceptance
Supersedes: ADR 0012's clause "with the induction prompt vendored verbatim and cited", and only that clause. The rest of ADR 0012 stands: the method is Agent Workflow Memory over pi session trees, reimplemented in TypeScript, with abandoned branches as the failure signal and no strategies in v1.

## Context

ADR 0012 chose Agent Workflow Memory (AWM, Wang et al., ICML 2025) and said its induction prompt is vendored verbatim. Card D2, rewritten by the absorb plan on 2026-11-21, asks for the prompt "adapted from web tasks to tool-use sessions", with the adaptation written down prompt by prompt. The two disagree. Card D2's review (finding D2-1) put the question to the lead, and he answered on 2026-11-22: adapt, and record it in a new ADR (`docs/tasks/lead-decisions.md`, item 64).

The upstream prompt is `webarena/prompt/instruction.txt` at commit `8c0ff8cd11d648c8fceb99e4e42f37e3b75381b1` of `zorazrw/agent-workflow-memory` (Apache-2.0), with `webarena/prompt/one_shot.txt` and the assembly in `webarena/induce_prompt.py`. It asks a model for the common workflows of "web navigation tasks", whose actions are browser calls such as `click('227')` and `fill('id', 'text')`, and whose invariants are element ids such as that of "Search". A pi session has none of these: its actions are tool calls with JSON arguments, its non-fixed elements are paths, symbols and command arguments, and its one-shot example would show clicks the model never sees. Sending the click prompt over tool calls would not be the same method either. It would ask for one thing and show another, and the one-shot would teach a format the reply must not use.

## Decision

The induction prompt is the adapted one, pinned as `AWM_INSTRUCTION` and `AWM_ONE_SHOT` in `packages/core/src/distill/induce.ts` at the commit that merges card D2. It is cited, with the upstream text at `8c0ff8cd`, in that file's header, in `NOTICE` and in `docs/absorbed.md`. Every change to the upstream method, eighteen in all:

1. Instruction, sentence 1: "web navigation tasks" becomes "tool-use tasks".
2. Instruction, sentence 2: "a series of actions" becomes "a series of steps", each "the agent's reasoning and the tool calls it made, one call per line as tool_name(arguments as JSON)", and "the repetitive subset of actions" becomes "of steps".
3. Instruction, sentence 3: the non-fixed elements "(input text, button strings)" become "(file paths, symbol names, input text, command arguments)".
4. Instruction, sentence 4: the invariants "e.g., id of "Search" or "Customers"" become "e.g., tool names and fixed command flags".
5. Instruction, sentence 5 is unchanged.
6. Added sentence: the attempts listed under "Abandoned attempts" did not lead to the solution, so no workflow is built from their steps (the negative evidence of ADR 0012 and card D2 step 3).
7. Added sentence: each workflow opens with `Workflow <number>: <what it does>`, then `Use when: <the situation that calls for it>`, then its steps. The `Use when:` line gives a SKILL.md its description.
8. The one-shot keeps upstream's shape (concrete examples, then summary workflows), with a new synthetic example: two coding tasks, one with an abandoned attempt, and two summary workflows with `Use when:` lines, in place of three web tasks and three workflows.
9. An example's actions are tool calls, written `tool(<arguments as JSON>)`, one a line, in place of browser calls.
10. A step that has actions and no reasoning text gets no `<think>` block. Upstream's `format_trajectory` always writes one.
11. An example's abandoned branches (with pi's branch summary when there is one) and withdrawn attempts follow its actions, under "Abandoned attempts".
12. Upstream's `remove_invalid_steps` drops malformed browser calls (a `click` whose element id is not a quoted integer, a `fill` whose target is not a string) and `scroll` and `noop`. Tool calls have no such syntax, so the analogue keeps a call only when its result says it succeeded and no context edit withdrew it.
13. Upstream picks one random trajectory per intent template (`random_group_sample`). Here the run's config names the example sessions, and nothing is sampled.
14. Upstream writes the model's reply to a workflow file whole. Here the reply is split into workflows on its `Workflow <n>:` lines. A workflow becomes a candidate only if it makes at least two calls, calls only tools that succeeded in an example, and gives a valid SKILL.md whose name no earlier workflow took.

15. The request carries the config's seed (ADR 0017, AGENTS.md rule 6). Upstream's call sends none.
16. Upstream appends two fixed lines to the model's reply before writing the workflow file, `click('id') # input string id value for all actions` and `select_option('id', 'value') # for dropdown menu`. They are browser calls, and nothing is appended here.
17. An example is a session whose recorded verdict (its `engram.outcome` entry) is `success`. Upstream takes trajectories whose ground-truth reward is set (`gt`) or that its model evaluator judged correct (`autoeval`).
18. An example's `Query:` is the first user message on its final branch. Upstream's is the task config's `intent`; a pi session has no such field.

Kept as upstream has them: the assembly (instruction, one-shot, `## Concrete Examples`, the examples, `## Summary Workflows`), one user message with no system prompt, temperature 1.0 and 2048 tokens, the `Query:`, `Actions:`, `<think>` and `<action>` layout, and every sentence of the instruction not listed above.

## Alternatives considered

(a) Vendor the WebArena prompt verbatim, as ADR 0012 said, and send it over tool-call trajectories: the model is asked about clicks and shown clicks, then given tool calls, so the reply's format and its variables follow the one-shot rather than the data. (b) Vendor the Mind2Web prompt verbatim: it is just as web-specific and has no reasoning blocks. (c) Write a new prompt from scratch: that is not AWM, and H5 names AWM.

## Consequences

H5's induction runs the adapted prompt in both C2 and C5 (the pre-registration's "same induction method" holds, since both arms share it). A reviewer comparing with the paper reads this list. Changing the prompt after the pre-registration's tag needs an amendment and a new ADR. ADR 0012 carries a note naming this ADR. Until the lead accepts this ADR, the prompt in the code is the card's and the review's, and `scripts/test/tasks-and-decisions.test.ts` lists 0046 among the ADRs left for the owner.

## Sources

- `docs/decisions/0012-induction-awm-over-pi-sessions.md`
- `docs/tasks/D2.md`
- `docs/readings/litreview/2409.07429-awm.md`
- `https://github.com/zorazrw/agent-workflow-memory/blob/8c0ff8cd11d648c8fceb99e4e42f37e3b75381b1/webarena/prompt/instruction.txt`
- `docs/log/2026-11-22-d2-decision-adr-0046.md`
