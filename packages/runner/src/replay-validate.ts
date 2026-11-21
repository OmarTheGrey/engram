// The replay validation gate (card D3; ADR 0011, ADR 0026, ADR 0042
// proposed): a candidate procedure is replayed on tasks it was not induced
// from, and becomes active through Plane.promote only when it passes at least
// replay_k of replay_n of them.
//
// 1. The split is made by construction (core's heldOutTasks): every task of
//    the pool less the tasks the candidate was induced from. Plane.promote
//    refuses a replay that names one of those (core's replayProblem).
// 2. Each held-out task runs as a pi SDK session per seed without the
//    candidate (once per task and seed, shared by every candidate) and with
//    the candidate installed: its SKILL.md body and tool allowlist appended
//    to the system prompt (procedureBlock). A candidate is never readable
//    through the plane, so the replayer installs it itself. Every model call
//    goes through the cassette model (ADR 0017): seeded, keyed on (task,
//    arm, `none`, `none`, model, seed, prompt hash), a miss an error unless
//    `make fixtures` records it from the script.
// 3. The oracle is the task's own check: a database-state hash in the manner
//    of tau2-bench (the session's final database against the one the task's
//    gold actions produce from the same start, compared as a hash of the
//    canonical encoding), or the fixture's stated outcome (the final reply
//    names it). A tau2-bench task row is scored by its own database hash
//    check (tau2Reward, card B11's TaskRow); running tau2 itself with a
//    candidate installed is card X11's.
// 4. Admission is core's: the replay goes to Plane.promote, which derives the
//    validation record and decides with the policy's replay_k of replay_n;
//    the promote event (allow, or deny leaving a candidate) carries the
//    counts. The operator who ran the replay promotes, user-sourced; the
//    candidate was written by the distiller acting for them, model-sourced.
//
// Until card D2's induction lands, the candidates are hand-written in its
// candidate shape (fixtures/distill/d3-validate/candidates.json).
//
// The environment is synthetic: invented orders, no real person (AGENTS.md
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
  type ReplayOutcome,
  type ReplayRecord,
  type TaskScore,
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
  /** Only `pipeline`: a scripted model on fixtures. A live replay is card X11's (H5). */
  kind: z.literal("pipeline"),
  benchmark: z.literal(REPLAY_BENCHMARK),
  /** A folder holding tasks.json and candidates.json. */
  data: z.string(),
  /** `scripted/<id>`; its misses are answered from `script` only while recording. */
  model: z.string().regex(/^scripted\/\S+$/, "a pipeline config runs a scripted model"),
  seeds: z.array(z.number().int()).min(1).refine(unique, "seeds must be unique"),
  /** The policy the admission is judged under: its replay_k of replay_n. */
  preset: z.enum(["strict", "medium", "permissive"]),
  /** A held-out task passes when its mean reward with the candidate is at or above this. */
  threshold: z.number().gt(0).lte(1),
  /** The time every write and promotion is made at; injected, never read from a clock. */
  at: z.iso.datetime(),
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
  return {
    ...config,
    data: resolve(base, config.data),
    script: resolve(base, config.script),
    cassettes: resolve(base, config.cassettes),
  };
}

const Action = z.strictObject({
  name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()),
});
export type Action = z.infer<typeof Action>;

const Order = z.strictObject({
  status: z.enum(["pending", "delivered", "cancelled"]),
  address: z.string(),
  items: z.array(z.strictObject({ sku: z.string(), note: z.string() })),
  refunded: z.array(z.string()),
  cancel_reason: z.string().optional(),
});
const OrderDb = z.strictObject({ orders: z.record(z.string(), Order) });
export type OrderDb = z.infer<typeof OrderDb>;

const Task = z.strictObject({
  id: z.string().min(1),
  prompt: z.string().min(1),
  db: OrderDb,
  check: z.discriminatedUnion("kind", [
    /** tau2-bench's database check: the final database's hash against the gold actions' database. */
    z.strictObject({ kind: z.literal("db-hash"), gold: z.array(Action) }),
    /** The fixture's stated outcome: the final reply names it. */
    z.strictObject({ kind: z.literal("stated"), outcome: z.string().min(1) }),
  ]),
});
export type Task = z.infer<typeof Task>;

const Candidate = z.strictObject({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  induced_from: z.array(z.string().min(1)).min(1),
  /** The SKILL.md text (D2's toSkillMd output, by hand until D2 lands). */
  body: z.string().min(1),
  tools: z.array(z.string().min(1)).min(1),
  /** The fixture's label for the run's final check; never read by a session or the plane. */
  expected: z.enum(["active", "candidate"]),
});
export type Candidate = z.infer<typeof Candidate>;

const Script = z.strictObject({
  _comment: z.string().optional(),
  sessions: z.record(z.string(), z.array(z.unknown())),
});

export interface ReplayFixture {
  tasks: Task[];
  candidates: Candidate[];
}

/** The fixture's tasks and candidates; every induction task must be in the pool. */
export function loadReplayFixture(config: Pick<ReplayConfig, "data" | "name">): ReplayFixture {
  const read = (f: string) => JSON.parse(readFileSync(join(config.data, f), "utf8")) as unknown;
  const tasks = z
    .strictObject({ _comment: z.string().optional(), tasks: z.array(Task).min(1) })
    .parse(read("tasks.json")).tasks;
  const candidates = z
    .strictObject({ _comment: z.string().optional(), candidates: z.array(Candidate).min(1) })
    .parse(read("candidates.json")).candidates;
  const ids = new Set(tasks.map((t) => t.id));
  if (ids.size !== tasks.length) throw new Error(`config ${config.name}: a task id repeats`);
  if (!unique(candidates.map((c) => c.name)))
    throw new Error(`config ${config.name}: a candidate name repeats`);
  for (const c of candidates)
    for (const t of c.induced_from)
      if (!ids.has(t))
        throw new Error(
          `config ${config.name}: candidate ${c.name} names task ${t}, not in the pool`,
        );
  return { tasks, candidates };
}

/** The held-out tasks per candidate (core's split), and every task a baseline runs on, in pool order. */
export function replayPlan(fixture: ReplayFixture): {
  held_out: Record<string, string[]>;
  baseline: string[];
} {
  const pool = fixture.tasks.map((t) => t.id);
  const held_out = Object.fromEntries(
    fixture.candidates.map((c) => [c.name, heldOutTasks(pool, c.induced_from)]),
  );
  const any = new Set(Object.values(held_out).flat());
  return { held_out, baseline: pool.filter((t) => any.has(t)) };
}

// The environment: four tools over an order database, as tau2-bench's tools
// act on its domain database. They change what they are told to change; the
// policy of when a change is right is the agent's to follow, as in tau2.

const orderOf = (db: OrderDb, id: unknown) => {
  const order = typeof id === "string" ? db.orders[id] : undefined;
  if (!order) throw new Error(`no order ${String(id)}`);
  return order;
};

/** One tool call on `db`, in place; returns what the tool answers. */
export function act(db: OrderDb, action: Action): unknown {
  const a = action.arguments;
  const order = orderOf(db, a.order_id);
  switch (action.name) {
    case "get_order":
      return { order_id: a.order_id, ...order };
    case "update_address":
      order.address = String(a.address);
      return { ok: true };
    case "cancel_order":
      order.status = "cancelled";
      order.cancel_reason = String(a.reason);
      return { ok: true };
    case "refund_item":
      order.refunded.push(String(a.sku));
      return { ok: true };
    default:
      throw new Error(`no tool ${action.name}`);
  }
}

/** The database `actions` leave from `db`, which is not changed. */
export function applyActions(db: OrderDb, actions: readonly Action[]): OrderDb {
  const out = structuredClone(db);
  for (const a of actions) act(out, a);
  return out;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** A database's hash: sha256 of its canonical JSON, so key order never matters. */
export const dbHash = (db: OrderDb) => sha256(canonicalJson(db));

/** The task's own check of a session: 1 or 0. */
export function taskReward(task: Task, observed: { db: OrderDb; text: string }): number {
  if (task.check.kind === "db-hash")
    return dbHash(observed.db) === dbHash(applyActions(task.db, task.check.gold)) ? 1 : 0;
  return observed.text.toLowerCase().includes(task.check.outcome.toLowerCase()) ? 1 : 0;
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
    name: "get_order",
    label: "Get order",
    description: "Look up one order by its id: its status, address, items and refunds.",
    parameters: Type.Object({ order_id: Type.String() }),
  },
  {
    name: "update_address",
    label: "Update address",
    description: "Change the shipping address of an order.",
    parameters: Type.Object({ order_id: Type.String(), address: Type.String() }),
  },
  {
    name: "cancel_order",
    label: "Cancel order",
    description: "Cancel an order, with the user's reason.",
    parameters: Type.Object({ order_id: Type.String(), reason: Type.String() }),
  },
  {
    name: "refund_item",
    label: "Refund item",
    description: "Refund one item of an order by its sku.",
    parameters: Type.Object({ order_id: Type.String(), sku: Type.String() }),
  },
] as const;
export const REPLAY_TOOL_NAMES = TOOLS.map((t) => t.name);

/** The tools as a pi extension over one session's database, recording every call. */
function orderTools(db: OrderDb, calls: Action[]): ExtensionFactory {
  return (pi) => {
    for (const tool of TOOLS)
      pi.registerTool({
        ...tool,
        async execute(_toolCallId: string, params: Record<string, unknown>) {
          const action = { name: tool.name, arguments: params };
          calls.push(structuredClone(action));
          return { content: [{ type: "text", text: canonicalJson(act(db, action)) }], details: {} };
        },
      } as Parameters<typeof pi.registerTool>[0]);
  };
}

/** The agent's system prompt, the same in both arms. */
export const REPLAY_SYSTEM_PROMPT =
  "You are a retail support agent. Act on the user's orders only through the tools you are given, then reply to the user in one short message.";

/** How the candidate is installed: its SKILL.md body and allowlist, after the system prompt. */
export function procedureBlock(c: Pick<Candidate, "body" | "tools">): string {
  return [
    `<procedure tools="${c.tools.join(" ")}">`,
    "Follow this procedure when it applies to the request.",
    c.body.trim(),
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
  db_hash: string;
  tool_calls: Action[];
  text: string;
}

export interface ReplayCandidateResult {
  name: string;
  item_id: string;
  induced_from: string[];
  held_out: string[];
  record: ReplayRecord;
  tasks: TaskScore[];
  /** Core's admission, before Plane.promote, for the report; the event decides. */
  admission: { decision: "admit" | "refuse"; reason: string };
  event: Pick<MemoryEvent, "op" | "decision" | "policy_id" | "reason">;
  status: MemoryItem["status"];
  expected: Candidate["expected"];
}

export interface ReplayResult {
  config: string;
  rows: ReplayRow[];
  candidates: ReplayCandidateResult[];
  /** The plane's log: each candidate's write and its promotion. */
  events: MemoryEvent[];
  calls: { new: number; cached: number };
  usage: UsageRecord[];
  /** Candidates whose status is not the fixture's label. */
  mismatches: string[];
}

export interface ReplayOptions {
  cache?: CacheStore;
  /** Refuse misses (every run but `make fixtures`); unset means ENGRAM_OFFLINE=1 decides. */
  offline?: boolean;
}

const OPERATOR = "person:d3-operator";
/** The distiller, writing candidates for the operator: model-sourced (ADR 0004). */
const distiller: Actor = {
  id: OPERATOR,
  level: "person",
  memberships: [OPERATOR],
  source: "model",
};
/** The operator who ran the replay and presents it: user-sourced (ADR 0042 proposed). */
const operator: Actor = { ...distiller, source: "user" };

const textOf = (content: unknown): string =>
  Array.isArray(content)
    ? content.flatMap((c) => (c && c.type === "text" ? [String(c.text)] : [])).join("")
    : typeof content === "string"
      ? content
      : "";

/** The scripted answer source of one session while recording; a miss outside a recording never reaches it. */
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
  const db = structuredClone(task.db);
  const calls: Action[] = [];
  const cassette = cassettePiModel({
    model: config.model,
    seed,
    cwd,
    cache,
    context: replayContext(task.id, candidate?.name ?? null),
    answers: answersFor(config, script[key], key),
    ...(options.offline === undefined ? {} : { offline: options.offline }),
    onUsage,
  });
  const agentDir = join(cwd, ".pi-agent");
  const modelRuntime = await ModelRuntime.create({
    authPath: join(agentDir, "auth.json"),
    modelsPath: join(agentDir, "models.json"),
  });
  modelRuntime.registerNativeProvider(cassette.provider);
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    extensionFactories: [orderTools(db, calls)],
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
      reward: taskReward(task, { db, text }),
      db_hash: dbHash(db),
      tool_calls: calls,
      text,
    };
  } finally {
    session.dispose();
    rmSync(cwd, { recursive: true, force: true });
  }
}

/** The candidate as the distiller would write it: procedural, status candidate, model-sourced. */
function candidateItem(c: Candidate, id: string, at: string): MemoryItem {
  return {
    id,
    class: "procedural",
    scope: OPERATOR,
    owner: OPERATOR,
    content: { body: c.body, tools: [...c.tools] },
    provenance: {
      kind: "model",
      ref: `d3/candidate/${c.name}`,
      hash: `sha256:${sha256(c.body)}`,
      actor: OPERATOR,
    },
    confidence: 0.5,
    valid_from: at,
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "candidate",
    store_ref: null,
    schema_version: 1,
  } as MemoryItem;
}

/** Replay every candidate of the config and promote each through the plane. */
export async function runReplayConfig(
  config: ReplayConfig,
  options: ReplayOptions = {},
): Promise<ReplayResult> {
  const fixture = loadReplayFixture(config);
  const plan = replayPlan(fixture);
  const script = Script.parse(JSON.parse(readFileSync(config.script, "utf8"))).sessions;
  const cache = options.cache ?? fileCache(config.cassettes);
  const usage: UsageRecord[] = [];
  const onUsage = (u: UsageRecord) => usage.push(u);
  const taskById = new Map(fixture.tasks.map((t) => [t.id, t]));
  const rows: ReplayRow[] = [];
  const run = async (taskId: string, c: Candidate | null, seed: number) => {
    const row = await replaySession(
      config,
      taskById.get(taskId) as Task,
      c,
      seed,
      script,
      cache,
      options,
      onUsage,
    );
    rows.push(row);
    return row;
  };

  // Without any candidate: once per task and seed, shared by the candidates.
  const without = new Map<string, number>();
  for (const t of plan.baseline)
    for (const seed of config.seeds) without.set(`${t}@${seed}`, (await run(t, null, seed)).reward);

  const policy = loadPreset(config.preset);
  const db = openSqlite(":memory:");
  try {
    migrate(db);
    // Item and event ids from two counters, so they never meet (RV-EXP-10).
    const itemIds = sequentialIds("8");
    const plane = createPlane({
      db,
      adapter: createFakeAdapter(),
      policy,
      newId: sequentialIds("9"),
    });
    const candidates: ReplayCandidateResult[] = [];
    for (const c of fixture.candidates) {
      const written = await plane.write(
        distiller,
        candidateItem(c, itemIds(), config.at),
        config.at,
      );
      if (written.event.decision !== "allow" || written.item === null)
        throw new Error(`candidate ${c.name} was not written: ${written.event.reason}`);
      const itemId = written.item.id;
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
      const replay = { induced_from: c.induced_from, threshold: config.threshold, outcomes };
      const decided = admission(policy, replay);
      const promoted = await plane.promote(operator, itemId, OPERATOR, config.at, { replay });
      const status = itemStatus(plane.events(), itemId);
      candidates.push({
        name: c.name,
        item_id: itemId,
        induced_from: [...c.induced_from],
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
        expected: c.expected,
      });
    }
    return {
      config: config.name,
      rows,
      candidates,
      events: plane.events(),
      calls: { new: usage.filter((u) => !u.hit).length, cached: usage.filter((u) => u.hit).length },
      usage,
      mismatches: candidates
        .filter((c) => c.status !== c.expected)
        .map((c) => `${c.name} is ${c.status}, the fixture expects ${c.expected}`),
    };
  } finally {
    db.close();
  }
}

/** An item's status as the log's last event carrying it left it. */
function itemStatus(events: readonly MemoryEvent[], id: string): MemoryItem["status"] {
  let status: MemoryItem["status"] = "candidate";
  for (const e of events) if (e.item_id === id && e.item) status = e.item.status;
  return status;
}

/** results.jsonl, summary.json, usage.json and events.jsonl, as the other runners write them. */
export function writeReplayResult(result: ReplayResult, out: string): void {
  mkdirSync(out, { recursive: true });
  const lines = (xs: readonly unknown[]) => xs.map((x) => `${JSON.stringify(x)}\n`).join("");
  writeFileSync(join(out, "results.jsonl"), lines(result.rows));
  writeFileSync(join(out, "events.jsonl"), lines(result.events));
  const { config, candidates, calls, usage, mismatches } = result;
  writeFileSync(
    join(out, "summary.json"),
    `${JSON.stringify({ config, candidates, mismatches }, null, 2)}\n`,
  );
  writeFileSync(join(out, "usage.json"), `${JSON.stringify({ config, calls, usage }, null, 2)}\n`);
}

export interface ReplayCount {
  config: string;
  model: string;
  /** The fixture folder, relative to the repository when inside it. */
  data: string;
  seeds: number[];
  candidates: { name: string; induced_from: string[]; held_out: string[]; sessions: number }[];
  baseline_sessions: number;
  candidate_sessions: number;
  sessions: number;
}

/** COUNT=1: the sessions the config would run, per candidate; no model, no cassette. */
export function countReplayConfig(config: ReplayConfig, repo?: string): ReplayCount {
  const fixture = loadReplayFixture(config);
  const plan = replayPlan(fixture);
  const seeds = config.seeds.length;
  const candidates = fixture.candidates.map((c) => {
    const held = plan.held_out[c.name] as string[];
    return {
      name: c.name,
      induced_from: [...c.induced_from],
      held_out: held,
      sessions: held.length * seeds,
    };
  });
  const baseline_sessions = plan.baseline.length * seeds;
  const candidate_sessions = candidates.reduce((n, c) => n + c.sessions, 0);
  const rel = repo === undefined ? config.data : relative(repo, config.data).replaceAll("\\", "/");
  return {
    config: config.name,
    model: config.model,
    data: rel.startsWith("..") ? config.data : rel,
    seeds: [...config.seeds],
    candidates,
    baseline_sessions,
    candidate_sessions,
    sessions: baseline_sessions + candidate_sessions,
  };
}
