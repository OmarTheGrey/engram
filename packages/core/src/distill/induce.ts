// The induction (card D2, ADR 0012): recorded pi sessions in, candidate
// procedural items out, each a SKILL.md body (distill/skill.ts) with a tool
// allowlist and its lineage to the sessions it came from. Core calls no model
// by itself (AGENTS.md rule 4): the Agent Workflow Memory induction receives
// a ModelCall, which the runner seeds and caches (rules 6 and 7, ADR 0017).
//
// Ported from Agent Workflow Memory (zorazrw/agent-workflow-memory, commit
// 8c0ff8cd11d648c8fceb99e4e42f37e3b75381b1, Apache-2.0, LICENSE read at that
// commit; no NOTICE file there): webarena/induce_prompt.py (the prompt's
// assembly, `format_examples` and `format_trajectory`, and the request's
// temperature 1.0 and 2048 tokens), webarena/prompt/instruction.txt (the
// instruction, copied and adapted below), webarena/prompt/one_shot.txt (its
// shape: concrete examples, then summary workflows; the example itself is
// rewritten for tool use), and webarena/induce_rule.py (the rule-based
// variant, the paper's Appendix B, as the control). The adaptation from web
// tasks to tool-use sessions, prompt by prompt, is the decision entry
// docs/log/2026-11-21-d2-decision-prompt-adaptation.md.
//
// What each part does:
// - prepareSessions parses each session (episode.ts) and scrubs it
//   (scrub.ts, as the recorder does) before any of it reaches a prompt; a
//   session the scrub holds, a session with no `success` verdict (AWM
//   induces from judged successes only), and one whose final branch holds
//   no tool call are not examples, and the report says why.
// - An example's trajectory is its final branch: each model turn's text as
//   the reasoning (`<think>`) and its tool calls as the actions
//   (`<action>`, one `tool(arguments as JSON)` a line). A call a context
//   edit withdrew and a call whose result is an error are left out, as
//   AWM's `remove_invalid_steps` leaves out actions that did not run; a
//   turn with no action left is dropped, as AWM drops it.
// - Negative evidence (card D2 step 3, ADR 0012): the example's abandoned
//   branches, with the summary pi wrote when one was left, and its
//   withdrawn attempts (a run a context edit omitted, pi's retry after a
//   length cut or an error), listed under "Abandoned attempts" with every
//   call they made, so the model is told what did not lead to the solution.
// - The reply is split into workflows on `Workflow <n>: <title>` lines.
//   A workflow becomes a candidate only when it has at least two actions
//   (AWM's own rule), every action is a tool call, every tool it names was
//   called on an example's final branch (the allowlist never exceeds what
//   succeeded), and its title gives a SKILL.md the specification accepts
//   with a name no earlier workflow of the reply took. Every other workflow
//   is reported as rejected with its reason; nothing is retried.
// - The control (card D2 step 4) calls no model: the contiguous run of at
//   least two tool calls found on the most examples' final branches (ties
//   to the longer run, then the first in code-unit order), when two or more
//   examples share it; one candidate, its steps that run as the first
//   example holding it made it.
//
// Every candidate is a procedural item with status `candidate`, version 1,
// confidence CANDIDATE_CONFIDENCE, no ttl, no grants and an empty lineage
// (the schema's lineage names superseded versions); its lineage to sessions
// is `provenance.ref` (distillRef), and `provenance.hash` hashes those
// sessions as given. Its kind is the least trusted of `model` and its
// examples' sources as the recorder sets them (ADR 0004): `compaction` when
// a model-written summary is in any of them. The caller writes it through
// Plane.write (AGENTS.md rule 2).

import type { Distiller, DistillMethod, Session } from "../distill.ts";
import { canonicalJson, type ModelCall, type ModelRequest, sha256 } from "../model.ts";
import { leastTrusted } from "../policy/promotion.ts";
import type { MemoryItem } from "../schema.ts";
import { type Episode, episodeOf, InvalidSessionError, type Step } from "./episode.ts";
import { scrubEpisode } from "./scrub.ts";
import { SkillFormatError, skillName, skillTitle, toSkillMd } from "./skill.ts";

/** The induction methods: AWM's model-based induction, and its rule-based control. */
export const INDUCTION_METHODS = ["awm", "rule"] as const;
export type InductionMethod = (typeof INDUCTION_METHODS)[number];

/** A candidate's confidence: not validated, so neither held nor refuted. */
export const CANDIDATE_CONFIDENCE = 0.5;
/** AWM's rule: each workflow has at least two steps (counted as actions). */
export const MIN_WORKFLOW_STEPS = 2;
/** The request settings of AWM's webarena/induce_prompt.py. */
export const AWM_SETTINGS = { temperature: 1, maxTokens: 2048 } as const;

const REF_PREFIX = "distill:";

/** A candidate's provenance ref: the method and the ids of the sessions it was induced from. */
export function distillRef(method: InductionMethod, sessionIds: readonly string[]): string {
  if (sessionIds.length === 0)
    throw new Error("distillRef: a candidate comes from at least one session");
  for (const id of sessionIds)
    if (id === "" || /[,\s]/.test(id))
      throw new Error(`distillRef: session id ${JSON.stringify(id)} cannot be listed`);
  return `${REF_PREFIX}${method}:${sessionIds.join(",")}`;
}

/** The method and session ids a candidate's ref names; null for a ref distillRef did not write. */
export function parseDistillRef(
  ref: string,
): { method: InductionMethod; sessions: string[] } | null {
  const m = /^distill:(awm|rule):([^,\s]+(?:,[^,\s]+)*)$/.exec(ref);
  if (!m) return null;
  return { method: m[1] as InductionMethod, sessions: (m[2] as string).split(",") };
}

/**
 * AWM's instruction (webarena/prompt/instruction.txt), adapted to tool-use
 * sessions: web navigation becomes tool use, actions become tool calls, the
 * web's non-fixed elements and invariants become a tool session's, and three
 * sentences are added: one on the abandoned attempts (negative evidence), one
 * on the `Use when:` line a SKILL.md description needs, and the output format
 * the one-shot shows.
 */
export const AWM_INSTRUCTION = [
  "Given a list of tool-use tasks, your task is to extract the common workflows to solve these tasks.",
  "Each given task contains a natural language instruction, and a series of steps to solve the task. Each step is the agent's reasoning and the tool calls it made, one call per line as tool_name(arguments as JSON). You need to find the repetitive subset of steps across multiple tasks, and extract each of them out as a workflow.",
  "Each workflow should be a commonly-reused sub-routine of the tasks. Do not generate similar or overlapping workflows. Each workflow should have at least two steps. Represent the non-fixed elements (file paths, symbol names, input text, command arguments) with descriptive variable names as shown in the example.",
  "Keep the values of invariant elements, e.g., tool names and fixed command flags, as they will share and stay invariant across tasks.",
  "Try to generate as many workflows that can cover all the tasks in the input list.",
  'Some tasks also list attempts the agent abandoned or withdrew, under "Abandoned attempts". They did not lead to the solution: do not build a workflow from their steps, and prefer the steps the successful actions took instead.',
  'Start each workflow with a line "Workflow <number>: <what it does>", then a line "Use when: <the situation that calls for it>", then its steps, as in the example.',
].join("\n");

/**
 * AWM's one-shot (webarena/prompt/one_shot.txt) has three concrete web tasks
 * and three summary workflows; this one has the same shape for tool use: two
 * concrete tasks, one with an abandoned attempt, and two summary workflows,
 * each with its `Use when:` line. Synthetic; no fixture session is in it.
 */
export const AWM_ONE_SHOT = `## Concrete Examples

Query: Rename the function getUser to fetchUser in src/api.ts.
Actions:
<think>
I need to see where getUser is defined before renaming it.
</think>
<action>
read({"path":"src/api.ts"})
</action>

<think>
getUser is defined here and called in src/routes.ts. I will rename the definition first.
</think>
<action>
edit({"path":"src/api.ts","old":"getUser","new":"fetchUser"})
</action>

<think>
Now the call site.
</think>
<action>
edit({"path":"src/routes.ts","old":"getUser","new":"fetchUser"})
</action>

<think>
I will run the tests to check that nothing still uses the old name.
</think>
<action>
bash({"command":"npm test"})
</action>

Query: The test for parseDate fails; make it pass.
Actions:
<think>
I will run the failing test to see its error.
</think>
<action>
bash({"command":"npm test -- parseDate"})
</action>

<think>
The error points at src/date.ts. I will read it.
</think>
<action>
read({"path":"src/date.ts"})
</action>

<think>
The month is off by one. I will fix that line only.
</think>
<action>
edit({"path":"src/date.ts","old":"getMonth()","new":"getMonth() + 1"})
</action>

<think>
I will run the test again to confirm the fix.
</think>
<action>
bash({"command":"npm test -- parseDate"})
</action>
Abandoned attempts:
Attempt 1 (an abandoned branch; its summary: rewriting the parser from scratch broke three other tests):
<think>
The parser is hard to follow; I will rewrite it.
</think>
<action>
edit({"path":"src/date.ts","old":"function parseDate","new":"function parseDateV2"})
</action>

## Summary Workflows

Workflow 1: Change a definition and its call sites
Use when: a task renames or changes a symbol that other files use.
<think>
I need to see where {symbol} is defined before changing it.
</think>
<action>
read({"path":"{definition-file}"})
</action>

<think>
I will change the definition.
</think>
<action>
edit({"path":"{definition-file}","old":"{old-text}","new":"{new-text}"})
</action>

<think>
Now each call site.
</think>
<action>
edit({"path":"{call-site-file}","old":"{old-text}","new":"{new-text}"})
</action>

Workflow 2: Reproduce a failure, fix it, and confirm
Use when: a test or command fails and the task is to make it pass.
<think>
I will run the failing check to see its error.
</think>
<action>
bash({"command":"{test-command}"})
</action>

<think>
The error points at {source-file}. I will read it.
</think>
<action>
read({"path":"{source-file}"})
</action>

<think>
I will make the smallest change that fixes it, not rewrite the file.
</think>
<action>
edit({"path":"{source-file}","old":"{old-text}","new":"{new-text}"})
</action>

<think>
I will run the check again to confirm the fix.
</think>
<action>
bash({"command":"{test-command}"})
</action>`;

/** One reasoning and its tool calls, as AWM's `<think>` and `<action>` blocks. */
export interface TrajectoryStep {
  think: string;
  /** `tool(arguments as JSON)`, one per call. */
  actions: string[];
  /** The tool of each action, in order. */
  tools: string[];
}

/** A run of steps the session did not keep. */
export interface NegativeAttempt {
  kind: "abandoned-branch" | "withdrawn-attempt";
  /** The branch's summary, or the attempt's stop reason. */
  note: string | null;
  steps: TrajectoryStep[];
}

/** A session that is an example: its instruction, its final branch and its negative evidence. */
export interface InductionExample {
  session: Session;
  session_id: string;
  task_id: string | null;
  /** The first user message of the final branch. */
  query: string;
  trajectory: TrajectoryStep[];
  negatives: NegativeAttempt[];
  /** Whether a model-written summary is in the episode (the recorder's `compaction` source). */
  summarised: boolean;
}

export interface SkippedSession {
  session_id: string;
  reason: string;
}

const isFunction = (s: Step): s is Extract<Step, { kind: "function" }> => s.kind === "function";

/** Steps as `<think>`/`<action>` pairs; `keepFailed` false leaves out calls whose result is an error. */
function pairs(steps: readonly Step[], keepFailed: boolean, keepEmpty: boolean): TrajectoryStep[] {
  const out: TrajectoryStep[] = [];
  let current: (TrajectoryStep & { entry: string | null }) | null = null;
  const flush = () => {
    if (current && (current.actions.length > 0 || (keepEmpty && current.think !== "")))
      out.push({ think: current.think, actions: current.actions, tools: current.tools });
    current = null;
  };
  for (const s of steps) {
    if (s.kind === "generation") {
      flush();
      current = { think: s.text.trim(), actions: [], tools: [], entry: s.entry_id };
    } else if (isFunction(s) && s.caller === "model") {
      if (s.is_error === true && !keepFailed) continue;
      if (current === null || current.entry !== s.entry_id) {
        flush();
        current = { think: "", actions: [], tools: [], entry: s.entry_id };
      }
      current.actions.push(`${s.tool}(${JSON.stringify(s.arguments ?? {})})`);
      current.tools.push(s.tool);
    }
  }
  flush();
  return out;
}

/** The sessions' examples and the sessions that are not, in input order. */
export function prepareSessions(sessions: readonly Session[]): {
  examples: InductionExample[];
  skipped: SkippedSession[];
} {
  const examples: InductionExample[] = [];
  const skipped: SkippedSession[] = [];
  for (const session of sessions) {
    let episode: Episode;
    try {
      episode = episodeOf({
        id: session.id,
        timestamp: "",
        entries: session.entries,
        skipped_lines: 0,
      });
    } catch (e) {
      if (e instanceof InvalidSessionError) {
        skipped.push({ session_id: session.id, reason: `invalid: ${e.message}` });
        continue;
      }
      throw e;
    }
    const scrubbed = scrubEpisode(episode);
    if (scrubbed.held.length > 0) {
      skipped.push({
        session_id: session.id,
        reason: `held: ${scrubbed.held.length} identifier fields match the secret table`,
      });
      continue;
    }
    const ep = scrubbed.episode;
    if (ep.outcome.verdict !== "success") {
      skipped.push({
        session_id: session.id,
        reason: ep.outcome.verdict === null ? "no verdict" : `verdict ${ep.outcome.verdict}`,
      });
      continue;
    }
    const kept = ep.steps.filter((s) => s.context !== "omitted");
    const trajectory = pairs(kept, false, false);
    if (trajectory.length === 0) {
      skipped.push({ session_id: session.id, reason: "no tool call on its final branch" });
      continue;
    }
    const negatives: NegativeAttempt[] = [
      ...ep.abandoned.map((b) => ({
        kind: "abandoned-branch" as const,
        note: b.summary,
        steps: pairs(b.steps, true, true),
      })),
      ...ep.omitted.map((o) => {
        const ids = new Set(o.entry_ids);
        return {
          kind: "withdrawn-attempt" as const,
          note: o.stop_reason,
          steps: pairs(
            ep.steps.filter((s) => s.context === "omitted" && ids.has(s.entry_id)),
            true,
            true,
          ),
        };
      }),
    ].filter((n) => n.steps.length > 0);
    const user = kept.find((s) => s.kind === "user");
    examples.push({
      session,
      session_id: session.id,
      task_id: ep.task_id ?? session.task_id ?? null,
      query: user && user.kind === "user" ? user.text.trim() : "",
      trajectory,
      negatives,
      summarised: ep.summarised,
    });
  }
  return { examples, skipped };
}

/** AWM's `format_trajectory`. */
function formatTrajectory(steps: readonly TrajectoryStep[]): string {
  return steps
    .map((s) =>
      [
        ...(s.think === "" && s.actions.length > 0 ? [] : [`<think>\n${s.think}\n</think>`]),
        ...(s.actions.length > 0 ? [`<action>\n${s.actions.join("\n")}\n</action>`] : []),
      ].join("\n"),
    )
    .join("\n\n");
}

function formatNegative(n: NegativeAttempt, index: number): string {
  const label =
    n.kind === "abandoned-branch"
      ? `an abandoned branch${n.note ? `; its summary: ${n.note.replace(/\s+/g, " ").trim()}` : ""}`
      : `a withdrawn attempt${n.note ? `; it stopped with ${n.note}` : ""}`;
  return `Attempt ${index + 1} (${label}):\n${formatTrajectory(n.steps)}`;
}

/** One example as AWM's `format_examples` writes it, with its negative evidence after its actions. */
export function formatExample(e: InductionExample): string {
  const head = `Query: ${e.query}\nActions:\n${formatTrajectory(e.trajectory)}`;
  if (e.negatives.length === 0) return head;
  return `${head}\nAbandoned attempts:\n${e.negatives.map(formatNegative).join("\n\n")}`;
}

/** The induction prompt: instruction, one-shot, then the examples (AWM's `llm_generate`). */
export function awmPrompt(examples: readonly InductionExample[]): string {
  const formatted = [
    "## Concrete Examples",
    ...examples.map(formatExample),
    "## Summary Workflows",
  ].join("\n\n");
  return [AWM_INSTRUCTION, AWM_ONE_SHOT, formatted].join("\n\n");
}

/** The request AWM's induction sends: one user message, its temperature and token limit, the config's model and seed. */
export function awmRequest(
  examples: readonly InductionExample[],
  method: Pick<DistillMethod, "model" | "seed">,
): ModelRequest {
  return {
    model: method.model,
    messages: [{ role: "user", content: awmPrompt(examples) }],
    seed: method.seed,
    temperature: AWM_SETTINGS.temperature,
    maxTokens: AWM_SETTINGS.maxTokens,
  };
}

/** A workflow as the reply gives it. */
export interface ParsedWorkflow {
  title: string;
  when: string | null;
  steps: { think: string; actions: string[] }[];
}

const WORKFLOW_LINE = /^\s*(?:#+\s*)?(?:\*\*)?\s*Workflow\s+\d+\s*[:.]\s*(.*?)\s*(?:\*\*)?\s*$/i;
const WHEN_LINE = /^\s*(?:\*\*)?Use when(?:\*\*)?\s*:\s*(.*?)\s*$/i;
const BLOCK =
  /<think>([\s\S]*?)<\/think>\s*<action>([\s\S]*?)<\/action>|<action>([\s\S]*?)<\/action>/g;

/** The reply's workflows, in order (AWM writes the reply whole; here it is split on its `Workflow <n>:` lines). */
export function parseWorkflows(text: string): ParsedWorkflow[] {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const starts = lines.flatMap((l, i) => (WORKFLOW_LINE.test(l) ? [i] : []));
  return starts.map((start, k) => {
    const end = starts[k + 1] ?? lines.length;
    const title = (WORKFLOW_LINE.exec(lines[start] as string)?.[1] ?? "")
      .replace(/\*+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const rest = lines.slice(start + 1, end);
    const firstBlock = rest.findIndex((l) => /<think>|<action>/.test(l));
    const head = firstBlock < 0 ? rest : rest.slice(0, firstBlock);
    const whenLine = head.map((l) => WHEN_LINE.exec(l)).find((m) => m !== null);
    const body = rest.join("\n");
    const steps: ParsedWorkflow["steps"] = [];
    for (const m of body.matchAll(BLOCK)) {
      const think = (m[1] ?? "").replace(/\s+/g, " ").trim();
      const actions = (m[2] ?? m[3] ?? "")
        .split("\n")
        .map((a) => a.trim())
        .filter((a) => a !== "");
      steps.push({ think, actions });
    }
    return { title, when: whenLine?.[1]?.trim() || null, steps };
  });
}

const TOOL_CALL = /^([A-Za-z_][\w.:-]*)\s*\(/;

/** A fence longer than any run of backticks in `text`. */
const fence = (text: string) =>
  "`".repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((m) => m[0].length + 1)));

/** A sentence without its closing period, so one can be added. */
const clause = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "");

/** The SKILL.md body of a workflow: its title, its description, its steps. */
export function workflowBody(w: ParsedWorkflow): string {
  const description = w.when
    ? `${clause(w.title)}. Use when ${clause(w.when)}.`
    : `${clause(w.title)}.`;
  const steps = w.steps.map((s, i) => {
    const code = s.actions.join("\n");
    const f = fence(code);
    const lead = `${i + 1}. ${s.think === "" ? "Make these calls." : s.think}`;
    return s.actions.length === 0
      ? lead
      : `${lead}\n\n   ${f}\n${s.actions.map((a) => `   ${a}`).join("\n")}\n   ${f}`;
  });
  return `# ${clause(w.title)}\n\n${description}\n\n## Steps\n\n${steps.join("\n\n")}\n`;
}

/** Who and where a candidate is written: the frame the caller supplies. */
export interface CandidateFrame {
  /** The scope every candidate is written into, such as `person:<id>`. */
  scope: string;
  owner: string;
  /** The principal that writes the candidates (provenance.actor). */
  actor: string;
  /** The time of the write, injected (core reads no clock). */
  at: string;
  /** UUIDv7 ids for the candidates. */
  newId: () => string;
}

export type WorkflowOutcome =
  | { title: string; status: "candidate"; item: MemoryItem }
  | { title: string; status: "rejected"; reason: string };

export interface InductionReport {
  method: InductionMethod;
  examples: { session_id: string; task_id: string | null }[];
  skipped: SkippedSession[];
  /** The model request (awm only). */
  request?: ModelRequest;
  /** The model's reply (awm only). */
  reply?: string;
  /** The control's chosen run of tools and how many examples hold it (rule only). */
  sequence?: { tools: string[]; support: number } | null;
  workflows: WorkflowOutcome[];
  /** The candidates, in the order of `workflows`. */
  items: MemoryItem[];
}

/** The source a candidate takes: the least trusted of `model` and its examples' (ADR 0004). */
export function candidateSource(examples: readonly Pick<InductionExample, "summarised">[]) {
  return leastTrusted([
    "model",
    ...examples.map((e): "model" | "compaction" => (e.summarised ? "compaction" : "model")),
  ]) as "model" | "compaction";
}

/** The frame and provenance of the item skillProblem writes to check a body; never stored. */
const PROBE_FRAME: CandidateFrame = {
  scope: "org",
  owner: "probe",
  actor: "probe",
  at: "",
  newId: () => "probe",
};
const PROBE_PROVENANCE = {
  kind: "model",
  ref: "probe",
  hash: `sha256:${"0".repeat(64)}`,
  actor: "probe",
} as const;

/** A candidate item for `body` and `tools`, induced from `examples`. */
function candidate(
  method: InductionMethod,
  body: string,
  tools: string[],
  examples: readonly InductionExample[],
  frame: CandidateFrame,
  model?: string,
): MemoryItem {
  return {
    id: frame.newId(),
    class: "procedural",
    scope: frame.scope,
    owner: frame.owner,
    content: { body, tools },
    provenance: {
      kind: candidateSource(examples),
      ref:
        examples.length === 0
          ? PROBE_PROVENANCE.ref
          : distillRef(
              method,
              examples.map((e) => e.session_id),
            ),
      hash: `sha256:${sha256(canonicalJson(examples.map((e) => e.session)))}`,
      actor: frame.actor,
      ...(model === undefined ? {} : { model }),
    },
    confidence: CANDIDATE_CONFIDENCE,
    valid_from: frame.at,
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "candidate",
    store_ref: null,
    schema_version: 1,
  };
}

/** The reason a body would not make a SKILL.md, or null; `names` holds the names taken so far. */
function skillProblem(body: string, tools: string[], names: Set<string>): string | null {
  try {
    const name = skillName(skillTitle(body));
    toSkillMd({
      ...candidate("awm", body, tools, [], PROBE_FRAME),
      provenance: { ...PROBE_PROVENANCE },
    } as MemoryItem);
    if (names.has(name)) return `its skill name ${name} is taken by an earlier workflow`;
    names.add(name);
    return null;
  } catch (e) {
    if (e instanceof SkillFormatError) return e.problems.join("; ");
    throw e;
  }
}

/** The tools called on the examples' final branches: what an allowlist may hold. */
const succeededTools = (examples: readonly InductionExample[]) =>
  new Set(examples.flatMap((e) => e.trajectory.flatMap((s) => s.tools)));

/** Agent Workflow Memory's induction over `sessions`, through the injected model call. */
export async function induceAwm(
  sessions: readonly Session[],
  method: Pick<DistillMethod, "model" | "seed">,
  call: ModelCall,
  frame: CandidateFrame,
): Promise<InductionReport> {
  const { examples, skipped } = prepareSessions(sessions);
  const base = {
    method: "awm" as const,
    examples: examples.map((e) => ({ session_id: e.session_id, task_id: e.task_id })),
    skipped,
  };
  if (examples.length === 0) return { ...base, workflows: [], items: [] };
  const request = awmRequest(examples, method);
  const reply = (await call(request)).text;
  const allowed = succeededTools(examples);
  const names = new Set<string>();
  const workflows: WorkflowOutcome[] = parseWorkflows(reply).map((w) => {
    const actions = w.steps.flatMap((s) => s.actions);
    const reject = (reason: string): WorkflowOutcome => ({
      title: w.title,
      status: "rejected",
      reason,
    });
    if (actions.length < MIN_WORKFLOW_STEPS)
      return reject(
        `it has ${actions.length} actions; a workflow has at least ${MIN_WORKFLOW_STEPS}`,
      );
    const tools: string[] = [];
    for (const a of actions) {
      const tool = TOOL_CALL.exec(a)?.[1];
      if (tool === undefined) return reject(`the action ${JSON.stringify(a)} is not a tool call`);
      if (!allowed.has(tool))
        return reject(`it calls ${tool}, which no example's final branch called`);
      if (!tools.includes(tool)) tools.push(tool);
    }
    const body = workflowBody(w);
    const problem = skillProblem(body, tools, names);
    if (problem !== null) return reject(problem);
    return {
      title: w.title,
      status: "candidate",
      item: candidate("awm", body, tools, examples, frame, method.model),
    };
  });
  return {
    ...base,
    request,
    reply,
    workflows,
    items: workflows.flatMap((w) => (w.status === "candidate" ? [w.item] : [])),
  };
}

/** The control: the most frequent successful run of tool calls, with no model (see the header). */
export function induceByRule(sessions: readonly Session[], frame: CandidateFrame): InductionReport {
  const { examples, skipped } = prepareSessions(sessions);
  const base = {
    method: "rule" as const,
    examples: examples.map((e) => ({ session_id: e.session_id, task_id: e.task_id })),
    skipped,
  };
  // Each example's calls in order, with the step each came from.
  const calls = examples.map((e) =>
    e.trajectory.flatMap((s) =>
      s.tools.map((tool, i) => ({ tool, action: s.actions[i] as string, think: s.think })),
    ),
  );
  const support = new Map<string, Set<number>>();
  calls.forEach((seq, ex) => {
    for (let i = 0; i < seq.length; i++)
      for (let j = i + MIN_WORKFLOW_STEPS; j <= seq.length; j++) {
        const key = seq
          .slice(i, j)
          .map((c) => c.tool)
          .join("\u0000");
        const holders = support.get(key) ?? new Set<number>();
        holders.add(ex);
        support.set(key, holders);
      }
  });
  let best: { key: string; tools: string[]; holders: Set<number> } | null = null;
  for (const [key, holders] of support) {
    const tools = key.split("\u0000");
    if (
      best === null ||
      holders.size > best.holders.size ||
      (holders.size === best.holders.size &&
        (tools.length > best.tools.length ||
          (tools.length === best.tools.length && key < best.key)))
    )
      best = { key, tools, holders };
  }
  if (best === null || best.holders.size < 2)
    return { ...base, sequence: null, workflows: [], items: [] };
  const first = Math.min(...best.holders);
  const seq = calls[first] as { tool: string; action: string; think: string }[];
  let at = 0;
  for (; at + best.tools.length <= seq.length; at++)
    if (
      seq
        .slice(at, at + best.tools.length)
        .map((c) => c.tool)
        .join("\u0000") === best.key
    )
      break;
  const run = seq.slice(at, at + best.tools.length);
  const title = `Call ${best.tools.join(", then ")}`;
  const description = `${title}, in this order: the run of tool calls found on the most successful sessions, ${best.holders.size} of ${examples.length}. Use when a task resembles the sessions it was induced from.`;
  const steps = run.map((c, i) => {
    const f = fence(c.action);
    return `${i + 1}. Call \`${c.tool}\`, as one session did:\n\n   ${f}\n   ${c.action}\n   ${f}`;
  });
  const body = `# ${title}\n\n${description}\n\n## Steps\n\n${steps.join("\n\n")}\n`;
  const tools = [...new Set(best.tools)];
  const problem = skillProblem(body, tools, new Set());
  const workflows: WorkflowOutcome[] = [
    problem === null
      ? { title, status: "candidate", item: candidate("rule", body, tools, examples, frame) }
      : { title, status: "rejected", reason: problem },
  ];
  return {
    ...base,
    sequence: { tools: best.tools, support: best.holders.size },
    workflows,
    items: workflows.flatMap((w) => (w.status === "candidate" ? [w.item] : [])),
  };
}

/** The Distiller (distill.ts) of Agent Workflow Memory, with its model call and its frame injected. */
export function createAwmDistiller(deps: { call: ModelCall; frame: CandidateFrame }): Distiller {
  return {
    async distill(sessions, method) {
      if (method.id !== "awm")
        throw new Error(`createAwmDistiller: method ${String(method.id)} is not awm`);
      return (await induceAwm(sessions, method, deps.call, deps.frame)).items;
    },
  };
}
