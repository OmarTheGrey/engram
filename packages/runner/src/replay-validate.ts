// The replay validation gate (card D3; ADR 0011, ADR 0026, ADR 0045
// proposed): a candidate procedure is replayed on tasks it was not induced
// from, and becomes active through Plane.promote only when it passes at least
// replay_k of replay_n of them.
//
// 0. The candidates are card D2's: its induction config is run in process
//    (runInduceConfig, from D2's committed cassette, zero new calls) and each
//    stored candidate is written into this run's log as D2 writes it, by the
//    owner with the candidate's own provenance kind. The tasks a candidate
//    was induced from are its provenance ref's sessions (core's
//    parseDistillRef), mapped to their task ids by card D1's session index.
// 1. The split is made by construction (core's heldOutTasks): the config's
//    task pool less the tasks the candidate was induced from. Plane.promote
//    refuses a replay that names one of those (core's replayProblem).
// 2. Each held-out task runs as a pi SDK session per seed without a
//    candidate (once per task and seed, shared by every candidate) and with
//    the candidate installed: its SKILL.md (core's toSkillMd, as a harness
//    loads it) and tool allowlist appended to the system prompt
//    (procedureBlock). Plane.read returns only active items, so the replayer
//    installs the candidate itself. Every model call goes through the
//    cassette model (ADR 0017): seeded, keyed on (task, arm, `none`, `none`,
//    model, seed, prompt hash), a miss an error unless `make fixtures`
//    records it from the script.
// 3. The oracle is the task's own check: a state hash in the manner of
//    tau2-bench's database check (the session's final repository files
//    against the files the task's gold edits produce from the same start,
//    as a hash of the canonical encoding), or the fixture's stated outcome
//    (the final reply is exactly it). A tau2-bench task row is scored by its own
//    database hash check (tau2Reward, card B11's TaskRow); running tau2 with
//    a candidate installed is H5's run (card X11).
// 4. Admission is core's: the replay goes to Plane.promote, which derives the
//    validation record and decides with the policy's replay_k of replay_n;
//    the promote event (allow, or deny leaving a candidate) carries the
//    counts. The owner who ran the replay presents it, user-sourced.
//
// The repositories are synthetic: invented files, no real person (AGENTS.md
// rule 12).
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import {
  createAgentSession,
  DefaultResourceLoader,
  type ExtensionFactory,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { createFakeAdapter } from "@engram/adapters";
import {
  type Actor,
  admission,
  canonicalJson,
  createPlane,
  heldOutTasks,
  loadPreset,
  type MemoryEvent,
  type MemoryItem,
  migrate,
  openSqlite,
  parseDistillRef,
  parseSkillMd,
  REPLAY_THRESHOLD,
  type ReplayOutcome,
  type ReplayRecord,
  strictContentHash,
  type TaskScore,
  toSkillMd,
} from "@engram/core";
import {
  type CacheStore,
  type CallContext,
  fileCache,
  type ScriptStep,
  type UsageRecord,
} from "@engram/model";
import { Type } from "typebox";
import { z } from "zod";
import { NO_STORE } from "./config.ts";
import { sequentialIds } from "./gatemem-probe.ts";
import { readInduceConfig, runInduceConfig } from "./induce.ts";
import {
  type AnswerSource,
  cassettePiModel,
  scriptedAnswers,
  sessionFailure,
} from "./model/cassette.ts";

export const REPLAY_BENCHMARK = "replay-validate";

const unique = <T>(values: readonly T[]) => new Set(values).size === values.length;

export const ReplayConfig = z.strictObject({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  /** Only `pipeline`: a scripted model on fixtures. A live replay is H5's (card X11). */
  kind: z.literal("pipeline"),
  benchmark: z.literal(REPLAY_BENCHMARK),
  /** Card D2's induction config whose candidates are replayed. */
  induce: z.string(),
  /** Card D1's session index: session id to task id. */
  sessions_index: z.string(),
  /** A folder holding tasks.json, the task pool. */
  data: z.string(),
  /** `scripted/<id>`; its misses are answered from `script` only while recording. */
  model: z.string().regex(/^scripted\/\S+$/, "a pipeline config runs a scripted model"),
  seeds: z.array(z.number().int()).min(1).refine(unique, "seeds must be unique"),
  /** The policy the admission is judged under: its replay_k of replay_n. */
  preset: z.enum(["strict", "medium", "permissive"]),
  /**
   * The seed the replay_n held-out tasks are drawn by from each candidate's
   * split (the lead's answer to D3-1, 2026-11-22). The pass threshold is not
   * a config field: it is core's registered REPLAY_THRESHOLD, 2/3 (D3-2).
   */
  draw_seed: z.number().int(),
  /** The candidates replayed, by skill name: a fixed subset of D2's, so the fixture stays small. */
  candidates: z.array(z.string().min(1)).min(1).refine(unique, "candidates must be unique"),
  /** The time every write and promotion is made at; injected, never read from a clock. */
  at: z.iso.datetime(),
  /** The fixture's label per candidate skill name, read only by the run's final check. */
  expected: z.record(z.string(), z.enum(["active", "candidate"])),
  script: z.string(),
  cassettes: z.string(),
});
export type ReplayConfig = z.infer<typeof ReplayConfig>;

/** Whether the JSON config at `path` is a replay validation config. */
export function isReplayConfig(path: string): boolean {
  const raw = JSON.parse(readFileSync(path, "utf8")) as { benchmark?: unknown };
  return raw.benchmark === REPLAY_BENCHMARK;
}

/** A config read from disk, its paths resolved against the file's folder. */
export function readReplayConfig(path: string): ReplayConfig {
  const config = ReplayConfig.parse(JSON.parse(readFileSync(path, "utf8")));
  const base = dirname(resolve(path));
  const at = (p: string) => resolve(base, p);
  return {
    ...config,
    induce: at(config.induce),
    sessions_index: at(config.sessions_index),
    data: at(config.data),
    script: at(config.script),
    cassettes: at(config.cassettes),
  };
}

const Action = z.strictObject({
  name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()),
});
export type Action = z.infer<typeof Action>;

/** A synthetic repository: its files by path. */
export interface Repo {
  files: Record<string, string>;
}

const Task = z.strictObject({
  /** A task id of card D1's sessions. */
  id: z.string().min(1),
  prompt: z.string().min(1),
  files: z.record(z.string(), z.string()),
  /** What `bash` prints for each command; any other command is not found. */
  commands: z.record(z.string(), z.string()),
  check: z.discriminatedUnion("kind", [
    /** tau2-bench's database check, on files: the final state's hash against the gold edits' state. */
    z.strictObject({ kind: z.literal("state-hash"), gold: z.array(Action) }),
    /** The fixture's stated outcome: the final reply is exactly it, trimmed. */
    z.strictObject({ kind: z.literal("stated"), outcome: z.string().min(1) }),
  ]),
});
export type Task = z.infer<typeof Task>;

const SessionIndex = z.object({
  sessions: z.array(z.object({ session_id: z.string(), task_id: z.string() })),
});

const Script = z.strictObject({
  _comment: z.string().optional(),
  sessions: z.record(z.string(), z.array(z.unknown())),
});

/** One of card D2's stored candidates, with the tasks it was induced from. */
export interface Candidate {
  /** Its skill name (parseSkillMd of toSkillMd). */
  name: string;
  method: string;
  item: MemoryItem;
  /** Its SKILL.md, as a harness loads it. */
  skill_md: string;
  /** The sessions its provenance ref names. */
  sessions: string[];
  /** Their task ids (card D1's index). */
  induced_from: string[];
}

/** The pool of replay tasks. */
export function loadReplayTasks(config: Pick<ReplayConfig, "data" | "name">): Task[] {
  const doc = z
    .strictObject({ _comment: z.string().optional(), tasks: z.array(Task).min(1) })
    .parse(JSON.parse(readFileSync(join(config.data, "tasks.json"), "utf8")));
  if (!unique(doc.tasks.map((t) => t.id)))
    throw new Error(`config ${config.name}: a task id repeats`);
  return doc.tasks;
}

/** Session id to task id, from card D1's index. */
export function sessionTasks(config: Pick<ReplayConfig, "sessions_index">): Map<string, string> {
  const index = SessionIndex.parse(JSON.parse(readFileSync(config.sessions_index, "utf8")));
  return new Map(index.sessions.map((s) => [s.session_id, s.task_id]));
}

/** Card D2's candidates for `items` (runInduceConfig's), each with the tasks it was induced from. */
export function candidatesOf(
  items: readonly { method: string; item: MemoryItem }[],
  tasksOf: ReadonlyMap<string, string>,
): Candidate[] {
  const out = items.map(({ method, item }): Candidate => {
    const ref = parseDistillRef(item.provenance.ref);
    if (ref === null)
      throw new Error(`candidate ${item.id} has no distill ref: ${item.provenance.ref}`);
    const induced_from = ref.sessions.map((s) => {
      const task = tasksOf.get(s);
      if (task === undefined)
        throw new Error(`candidate ${item.id} names session ${s}, not in D1's index`);
      return task;
    });
    const skill_md = toSkillMd(item);
    return {
      name: parseSkillMd(skill_md).name,
      method,
      item,
      skill_md,
      sessions: ref.sessions,
      induced_from: [...new Set(induced_from)],
    };
  });
  if (!unique(out.map((c) => c.name))) throw new Error("two candidates share a skill name");
  return out;
}

/** A task's prompt and start state, as one key: two tasks with the same key are the same task. */
const taskKey = (t: Pick<Task, "prompt" | "files">) =>
  `${t.prompt}\u0000${stateHash({ files: t.files })}`;

/** mulberry32, seeded by sha256 of the draw seed: the seeded draw the runner uses (rule 6). */
function seededStream(seed: number): () => number {
  let a = createHash("sha256").update(`d3-draw:${seed}`).digest().readUInt32BE(0);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `n` tasks of a candidate's split, drawn by `seed` (the lead's answer to
 * D3-1): a Fisher-Yates shuffle of the split in pool order, its first `n`,
 * back in pool order. A split of fewer than `n` tasks cannot be replayed.
 */
export function drawHeldOut(split: readonly string[], n: number, seed: number): string[] {
  if (split.length < n)
    throw new Error(
      `the split holds ${split.length} held-out tasks, fewer than the policy's replay_n ${n}`,
    );
  const next = seededStream(seed);
  const order = [...split];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j] as string, order[i] as string];
  }
  const drawn = new Set(order.slice(0, n));
  return split.filter((t) => drawn.has(t));
}

/**
 * The held-out tasks per candidate (core's split, then `n` of it drawn by
 * `seed`), and every task a baseline runs on, in pool order. A held-out task
 * whose prompt and start state equal those of one of the candidate's
 * induction tasks in the pool is the same task under another id, and is
 * refused (card D3 review, D3-8).
 */
export function replayPlan(
  tasks: readonly Task[],
  candidates: readonly Pick<Candidate, "name" | "induced_from">[],
  draw: { n: number; seed: number },
): { held_out: Record<string, string[]>; baseline: string[] } {
  const pool = tasks.map((t) => t.id);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const held_out = Object.fromEntries(
    candidates.map((c) => {
      const held = heldOutTasks(pool, c.induced_from);
      const induced = new Map(
        c.induced_from.flatMap((id) => {
          const t = byId.get(id);
          return t === undefined ? [] : [[taskKey(t), id] as const];
        }),
      );
      for (const id of held) {
        const same = induced.get(taskKey(byId.get(id) as Task));
        if (same !== undefined)
          throw new Error(
            `held-out task ${id} has the prompt and start state of ${same}, a task ${c.name} was induced from`,
          );
      }
      return [c.name, drawHeldOut(held, draw.n, draw.seed)];
    }),
  );
  const any = new Set(Object.values(held_out).flat());
  return { held_out, baseline: pool.filter((t) => any.has(t)) };
}

// The environment: pi's read, edit and bash tools over a synthetic
// repository, as tau2-bench's tools act on its domain database. An edit whose
// text is not in the file changes nothing and says so, as pi's edit does.

/** One tool call on `repo`, in place; returns what the tool answers. */
export function act(repo: Repo, task: Pick<Task, "commands">, action: Action): string {
  const a = action.arguments;
  const path = String(a.path);
  switch (action.name) {
    case "read":
      return repo.files[path] ?? `error: no file ${path}`;
    case "edit": {
      const text = repo.files[path];
      if (text === undefined) return `error: no file ${path}`;
      const old = String(a.old);
      if (old === "" || !text.includes(old))
        return `error: the text to replace was not found in ${path}; nothing changed`;
      repo.files[path] = text.replace(old, () => String(a.new));
      return `edited ${path}`;
    }
    case "bash": {
      const command = String(a.command);
      return task.commands[command] ?? `bash: command not found: ${command}`;
    }
    default:
      throw new Error(`no tool ${action.name}`);
  }
}

/** The repository `actions` leave from `files`, which are not changed. */
export function applyActions(
  task: Pick<Task, "files" | "commands">,
  actions: readonly Action[],
): Repo {
  const repo = { files: { ...task.files } };
  for (const a of actions) act(repo, task, a);
  return repo;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** A repository's state hash: sha256 of its canonical JSON, so key order never matters. */
export const stateHash = (repo: Repo) => sha256(canonicalJson(repo));

/** The task's own check of a session: 1 or 0. */
export function taskReward(task: Task, observed: { repo: Repo; text: string }): number {
  if (task.check.kind === "state-hash")
    return stateHash(observed.repo) === stateHash(applyActions(task, task.check.gold)) ? 1 : 0;
  // The whole reply, exactly (card D3 review, D3-10): a substring would let
  // "not delivered" pass "delivered".
  return observed.text.trim() === task.check.outcome.trim() ? 1 : 0;
}

/**
 * A tau2-bench task's reward for the replay: its database hash check alone
 * (card B11's TaskRow, packages/bench/src/tau2/result.ts), which the runner
 * takes by shape since @engram/bench does not export tau2.
 */
export function tau2Reward(row: { db_match: boolean; db_reward: number }): number {
  const reward = row.db_match ? 1 : 0;
  if (row.db_reward !== reward)
    throw new Error(
      `a tau2 row's db_match ${row.db_match} and db_reward ${row.db_reward} disagree`,
    );
  return reward;
}

const TOOLS = [
  {
    name: "read",
    label: "Read",
    description: "Read a file of the repository.",
    parameters: Type.Object({ path: Type.String() }),
  },
  {
    name: "edit",
    label: "Edit",
    description: "Replace the first occurrence of `old` with `new` in a file.",
    parameters: Type.Object({ path: Type.String(), old: Type.String(), new: Type.String() }),
  },
  {
    name: "bash",
    label: "Bash",
    description: "Run a shell command in the repository.",
    parameters: Type.Object({ command: Type.String() }),
  },
] as const;
export const REPLAY_TOOL_NAMES = TOOLS.map((t) => t.name);

/** The tools as a pi extension over one session's repository, recording every call. */
function repoTools(repo: Repo, task: Task, calls: Action[]): ExtensionFactory {
  return (pi) => {
    for (const tool of TOOLS)
      pi.registerTool({
        ...tool,
        async execute(_toolCallId: string, params: Record<string, unknown>) {
          const action = { name: tool.name, arguments: params };
          calls.push(structuredClone(action));
          return { content: [{ type: "text", text: act(repo, task, action) }], details: {} };
        },
      } as Parameters<typeof pi.registerTool>[0]);
  };
}

/** The agent's system prompt, the same in both arms. */
export const REPLAY_SYSTEM_PROMPT =
  "You are a coding agent in a small TypeScript repository. Change it only through the tools you are given, then reply in one short message.";

/** How the candidate is installed: its SKILL.md and allowlist, after the system prompt. */
export function procedureBlock(c: Pick<Candidate, "skill_md" | "item">): string {
  const tools = (c.item.content as { tools: string[] }).tools;
  return [
    `<procedure tools="${tools.join(" ")}">`,
    "Follow this procedure when it applies to the task.",
    c.skill_md.trim(),
    "</procedure>",
  ].join("\n");
}

/** The cache context of one replay session: the task, and the arm (none, or the candidate). */
export const replayContext = (task: string, candidate: string | null): CallContext => ({
  item: task,
  condition: candidate === null ? "replay/without" : `replay/with/${candidate}`,
  preset: "none",
  store: NO_STORE,
});

/** The script key of one session. */
export const scriptKey = (task: string, candidate: string | null) =>
  candidate === null ? `${task}/without` : `${task}/with/${candidate}`;

export interface ReplayRow {
  /** null for the session without a candidate. */
  candidate: string | null;
  task: string;
  seed: number;
  check: Task["check"]["kind"];
  reward: number;
  state_hash: string;
  tool_calls: Action[];
  text: string;
}

export interface ReplayCandidateResult {
  name: string;
  method: string;
  item_id: string;
  induced_from: string[];
  held_out: string[];
  record: ReplayRecord;
  tasks: TaskScore[];
  /** Core's admission, before Plane.promote, for the report; the event decides. */
  admission: { decision: "admit" | "refuse"; reason: string };
  event: Pick<MemoryEvent, "op" | "decision" | "policy_id" | "reason">;
  status: MemoryItem["status"];
  expected: "active" | "candidate";
}

export interface ReplayResult {
  config: string;
  rows: ReplayRow[];
  candidates: ReplayCandidateResult[];
  /** The plane's log: each candidate's write and its promotion. */
  events: MemoryEvent[];
  /** The replay's own calls (the induction's are in `induce_calls`). */
  calls: { new: number; cached: number };
  induce_calls: { new: number; cached: number };
  usage: UsageRecord[];
  /** Candidates whose status is not the fixture's label, or that it has no label for. */
  mismatches: string[];
}

export interface ReplayOptions {
  cache?: CacheStore;
  /** Refuse misses (every run but `make fixtures`); unset means ENGRAM_OFFLINE=1 decides. */
  offline?: boolean;
}

const textOf = (content: unknown): string =>
  Array.isArray(content)
    ? content.flatMap((c) => (c && c.type === "text" ? [String(c.text)] : [])).join("")
    : typeof content === "string"
      ? content
      : "";

/** The scripted answer source of one session while recording; outside a recording a miss never reaches it. */
function answersFor(config: ReplayConfig, steps: unknown[] | undefined, key: string): AnswerSource {
  if (steps === undefined)
    return async () => {
      throw new Error(`the d3 script has no session ${key}`);
    };
  const [provider, ...rest] = config.model.split("/");
  return scriptedAnswers(steps as ScriptStep[], {
    provider: provider as string,
    model: rest.join("/"),
  });
}

async function replaySession(
  config: ReplayConfig,
  task: Task,
  candidate: Candidate | null,
  seed: number,
  script: Record<string, unknown[]>,
  cache: CacheStore,
  options: ReplayOptions,
  onUsage: (u: UsageRecord) => void,
): Promise<ReplayRow> {
  const key = scriptKey(task.id, candidate?.name ?? null);
  const cwd = mkdtempSync(join(tmpdir(), "engram-d3-"));
  const repo: Repo = { files: { ...task.files } };
  const calls: Action[] = [];
  const cassette = cassettePiModel({
    model: config.model,
    seed,
    cwd,
    cache,
    context: replayContext(task.id, candidate?.name ?? null),
    // A seed's own steps when the script has them, else the session's.
    answers: answersFor(config, script[`${key}@${seed}`] ?? script[key], `${key}@${seed}`),
    ...(options.offline === undefined ? {} : { offline: options.offline }),
    onUsage,
  });
  try {
    const agentDir = join(cwd, ".pi-agent");
    const modelRuntime = await ModelRuntime.create({
      authPath: join(agentDir, "auth.json"),
      modelsPath: join(agentDir, "models.json"),
    });
    modelRuntime.registerNativeProvider(cassette.provider);
    const resourceLoader = new DefaultResourceLoader({
      cwd,
      agentDir,
      extensionFactories: [repoTools(repo, task, calls)],
      noSkills: true,
      noPromptTemplates: true,
      noContextFiles: true,
      noThemes: true,
      disabledBuiltinExtensions: ["mcp", "llama"],
      systemPrompt: REPLAY_SYSTEM_PROMPT,
      appendSystemPrompt: candidate === null ? [] : [procedureBlock(candidate)],
    });
    await resourceLoader.reload();
    const { session } = await createAgentSession({
      cwd,
      agentDir,
      model: cassette.model,
      thinkingLevel: "off",
      modelRuntime,
      resourceLoader,
      sessionManager: SessionManager.inMemory(cwd),
      settingsManager: SettingsManager.inMemory({
        compaction: { enabled: false },
        retry: { enabled: false },
      }),
      tools: [...REPLAY_TOOL_NAMES],
    });
    try {
      await session.prompt(task.prompt);
      const failure = sessionFailure(session.messages, cassette);
      if (failure !== undefined) throw failure;
      const final = [...session.messages].reverse().find((m) => m.role === "assistant");
      const text = final ? textOf(final.content) : "";
      return {
        candidate: candidate?.name ?? null,
        task: task.id,
        seed,
        check: task.check.kind,
        reward: taskReward(task, { repo, text }),
        state_hash: stateHash(repo),
        tool_calls: calls,
        text,
      };
    } finally {
      session.dispose();
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/** An item's status as the last event carrying it left it. */
function itemStatus(events: readonly MemoryEvent[], id: string): MemoryItem["status"] {
  let status: MemoryItem["status"] = "candidate";
  for (const e of events) if (e.item_id === id && e.item) status = e.item.status;
  return status;
}

/** Card D2's candidates for this config: its induction run in process, from its cassette. */
export async function induceCandidates(
  config: ReplayConfig,
  options: ReplayOptions = {},
): Promise<{ candidates: Candidate[]; calls: { new: number; cached: number } }> {
  const induced = await runInduceConfig(readInduceConfig(config.induce), {
    ...(options.offline === undefined ? {} : { offline: options.offline }),
  });
  const all = candidatesOf(induced.items, sessionTasks(config));
  const byName = new Map(all.map((c) => [c.name, c]));
  const candidates = config.candidates.map((name) => {
    const c = byName.get(name);
    if (c === undefined) throw new Error(`config ${config.name}: D2 induced no candidate ${name}`);
    return c;
  });
  return { candidates, calls: induced.calls };
}

/** Replay every candidate of the config and present each replay to Plane.promote. */
export async function runReplayConfig(
  config: ReplayConfig,
  options: ReplayOptions = {},
): Promise<ReplayResult> {
  const tasks = loadReplayTasks(config);
  // The induction replays its own committed cassette; `cache` is the replay's.
  const induced = await induceCandidates(config, { offline: true });
  const candidates = induced.candidates;
  const policy = loadPreset(config.preset);
  const plan = replayPlan(tasks, candidates, {
    n: policy.promotion.procedural.replay_n,
    seed: config.draw_seed,
  });
  const script = Script.parse(JSON.parse(readFileSync(config.script, "utf8"))).sessions;
  const cache = options.cache ?? fileCache(config.cassettes);
  const usage: UsageRecord[] = [];
  const onUsage = (u: UsageRecord) => usage.push(u);
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const rows: ReplayRow[] = [];
  const run = async (taskId: string, c: Candidate | null, seed: number) => {
    const task = taskById.get(taskId) as Task;
    const row = await replaySession(config, task, c, seed, script, cache, options, onUsage);
    rows.push(row);
    return row;
  };

  // Without a candidate: once per task and seed, shared by the candidates.
  const without = new Map<string, number>();
  for (const t of plan.baseline)
    for (const seed of config.seeds) without.set(`${t}@${seed}`, (await run(t, null, seed)).reward);

  const db = openSqlite(":memory:");
  try {
    migrate(db);
    // Event ids from their own counter, apart from D2's item ids (RV-EXP-10).
    const plane = createPlane({
      db,
      adapter: createFakeAdapter(),
      policy,
      newId: sequentialIds("9"),
      // The plane checks each replay's split against the candidate's own
      // distill ref through card D1's index (card D3 review, D3-3).
      distillTasks: sessionTasks(config),
    });
    const results: ReplayCandidateResult[] = [];
    for (const c of candidates) {
      const owner = c.item.owner;
      // Written as D2 writes it: by the owner, with the candidate's own kind.
      const writer: Actor = {
        id: owner,
        level: "person",
        memberships: [c.item.scope],
        source: c.item.provenance.kind,
      };
      const written = await plane.write(writer, { ...c.item, store_ref: null }, config.at);
      if (written.event.decision !== "allow")
        throw new Error(`candidate ${c.name} was not written: ${written.event.reason}`);
      const held = plan.held_out[c.name] as string[];
      const outcomes: ReplayOutcome[] = [];
      for (const t of held)
        for (const seed of config.seeds)
          outcomes.push({
            task: t,
            seed,
            without: without.get(`${t}@${seed}`) as number,
            with: (await run(t, c, seed)).reward,
          });
      const replay = {
        item_id: c.item.id,
        content_hash: strictContentHash(c.item.content),
        induced_from: c.induced_from,
        threshold: REPLAY_THRESHOLD,
        outcomes,
      };
      const decided = admission(policy, replay);
      // The owner who ran the replay presents it, user-sourced (ADR 0045 proposed).
      const operator: Actor = { ...writer, source: "user" };
      const promoted = await plane.promote(operator, c.item.id, c.item.scope, config.at, {
        replay,
      });
      const status = itemStatus(plane.events(), c.item.id);
      results.push({
        name: c.name,
        method: c.method,
        item_id: c.item.id,
        induced_from: c.induced_from,
        held_out: held,
        record: decided.record,
        tasks: decided.tasks,
        admission: { decision: decided.decision, reason: decided.reason },
        event: {
          op: promoted.event.op,
          decision: promoted.event.decision,
          policy_id: promoted.event.policy_id,
          reason: promoted.event.reason,
        },
        status,
        expected: config.expected[c.name] ?? "candidate",
      });
    }
    const unlabelled = candidates
      .filter((c) => config.expected[c.name] === undefined)
      .map((c) => `${c.name} has no label in the config's expected`);
    return {
      config: config.name,
      rows,
      candidates: results,
      events: plane.events(),
      calls: { new: usage.filter((u) => !u.hit).length, cached: usage.filter((u) => u.hit).length },
      induce_calls: induced.calls,
      usage,
      mismatches: [
        ...unlabelled,
        ...results
          .filter((c) => c.status !== c.expected)
          .map((c) => `${c.name} is ${c.status}, the fixture expects ${c.expected}`),
      ],
    };
  } finally {
    db.close();
  }
}

/** results.jsonl, summary.json, usage.json and events.jsonl, as the other runners write them. */
export function writeReplayResult(result: ReplayResult, out: string): void {
  mkdirSync(out, { recursive: true });
  const lines = (xs: readonly unknown[]) => xs.map((x) => `${JSON.stringify(x)}\n`).join("");
  writeFileSync(join(out, "results.jsonl"), lines(result.rows));
  writeFileSync(join(out, "events.jsonl"), lines(result.events));
  const { config, candidates, calls, induce_calls, usage, mismatches } = result;
  writeFileSync(
    join(out, "summary.json"),
    `${JSON.stringify({ config, candidates, mismatches }, null, 2)}\n`,
  );
  writeFileSync(
    join(out, "usage.json"),
    `${JSON.stringify({ config, calls, induce_calls, usage }, null, 2)}\n`,
  );
}

export interface ReplayCount {
  config: string;
  model: string;
  /** The task pool's folder, relative to the repository when inside it. */
  data: string;
  seeds: number[];
  pool: number;
  candidates: { name: string; induced_from: string[]; held_out: string[]; sessions: number }[];
  baseline_sessions: number;
  candidate_sessions: number;
  sessions: number;
}

/**
 * COUNT=1: the sessions the config would replay, per candidate; no replay
 * model is called and no replay cassette read. The candidates come from
 * D2's induction, replayed from its committed cassette (zero new calls).
 */
export async function countReplayConfig(config: ReplayConfig, repo?: string): Promise<ReplayCount> {
  const tasks = loadReplayTasks(config);
  const { candidates } = await induceCandidates(config, { offline: true });
  const plan = replayPlan(tasks, candidates, {
    n: loadPreset(config.preset).promotion.procedural.replay_n,
    seed: config.draw_seed,
  });
  const seeds = config.seeds.length;
  const counted = candidates.map((c) => {
    const held = plan.held_out[c.name] as string[];
    return {
      name: c.name,
      induced_from: c.induced_from,
      held_out: held,
      sessions: held.length * seeds,
    };
  });
  const baseline_sessions = plan.baseline.length * seeds;
  const candidate_sessions = counted.reduce((n, c) => n + c.sessions, 0);
  const rel = repo === undefined ? config.data : relative(repo, config.data).replaceAll("\\", "/");
  return {
    config: config.name,
    model: config.model,
    data: rel.startsWith("..") ? config.data : rel,
    seeds: [...config.seeds],
    pool: tasks.length,
    candidates: counted,
    baseline_sessions,
    candidate_sessions,
    sessions: baseline_sessions + candidate_sessions,
  };
}
