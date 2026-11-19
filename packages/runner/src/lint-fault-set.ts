// Both lint tiers over card L2's seeded-fault set (card L4): every state of a
// set directory (packages/bench/scripts/fault-set.ts wrote it: policy.json,
// states.jsonl) is loaded into a fresh log and Plane.lint runs over each of
// its scopes under the set's lint-time policy.
//
// - The deterministic floor runs the plane without a lint model, so only
//   card L1's lints run (lintFaultStateDeterministic); no model is called.
//   Beside the findings it records the units card L3's lints would send
//   (planModelLints), which is what the model run's count counts.
// - The model-based run (`benchmark: "fault-set"`, through run.ts) builds the
//   plane with a lint model per seed, the config's model behind
//   @engram/model's cache, so every call is seeded and keyed on (`fault-set/`
//   question, `lint`, the set's policy, `none`, model, seed, prompt hash)
//   (ADR 0017, AGENTS.md rule 7). A replay makes zero new calls.
//
// Nothing here reads labels.jsonl: the rows carry what the plane found and
// what every unit's reply said, and the scorers (research/scripts/
// h3_lint_floor.py and h3_lint_delta.py) join the labels by question and
// item. No label reaches a prompt or the plane.
import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { createFakeAdapter } from "@engram/adapters";
import type { faults } from "@engram/bench";
import {
  appendEvent,
  createPlane,
  currentItems,
  type LintFinding,
  type MemoryItem,
  type ModelCall,
  migrate,
  openSqlite,
  Policy,
  planModelLints,
} from "@engram/core";
import {
  type CacheStore,
  type CallContext,
  cached,
  fileCache,
  type UsageRecord,
} from "@engram/model";
import { z } from "zod";
import type { LiveModels } from "./answers.ts";
import { NO_STORE } from "./config.ts";
import { sequentialIds } from "./gatemem-probe.ts";
import { liveJudgeCall } from "./judge.ts";
import { LintScript, scriptedLintCall } from "./lint-faults.ts";

export const FAULT_SET_BENCHMARK = "fault-set";

type FaultState = faults.FaultState;

const unique = <T>(values: readonly T[]) => new Set(values).size === values.length;

export const FaultSetLintConfig = z.strictObject({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  /** As every runner config: `pipeline` on a scripted model, `experiment` on a named live one. */
  kind: z.enum(["pipeline", "experiment"]),
  benchmark: z.literal(FAULT_SET_BENCHMARK),
  /** A fault-set directory as packages/bench/scripts/fault-set.ts writes it. */
  data: z.string(),
  /** Question ids, in the set's order when `all`. */
  questions: z.union([
    z.literal("all"),
    z.array(z.string().min(1)).min(1).refine(unique, "questions must be unique"),
  ]),
  /** `provider/model-id`; `scripted/<id>` answers misses from `script`. */
  model: z.string().regex(/^[^/\s]+\/\S+$/, "model must be provider/model-id"),
  seeds: z.array(z.number().int()).min(1).refine(unique, "seeds must be unique"),
  script: z.string().optional(),
  cassettes: z.string(),
  /**
   * The sha256 of the set's files as card L2's result commits them
   * (research/results/h3-fault-set.json, `set.sha256`); an experiment must
   * name policy.json's and states.jsonl's, and runs or counts only on them.
   */
  sha256: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/)).optional(),
});
export type FaultSetLintConfig = z.infer<typeof FaultSetLintConfig>;

/** Whether the JSON config at `path` names a seeded-fault set. */
export function isFaultSetConfig(path: string): boolean {
  const raw = JSON.parse(readFileSync(path, "utf8")) as { benchmark?: unknown };
  return raw.benchmark === FAULT_SET_BENCHMARK;
}

export function parseFaultSetConfig(value: unknown, base = process.cwd()): FaultSetLintConfig {
  const config = FaultSetLintConfig.parse(value);
  const scripted = config.model.startsWith("scripted/");
  if (scripted && config.script === undefined)
    throw new Error(`config ${config.name}: a scripted model needs a script`);
  if (config.kind === "experiment" && (scripted || config.script !== undefined))
    throw new Error(
      `config ${config.name}: an experiment runs on a live model, never a scripted one or a script`,
    );
  if (config.kind === "experiment" && PINNED_FILES.some((f) => config.sha256?.[f] === undefined))
    throw new Error(
      `config ${config.name}: an experiment names the sha256 of ${PINNED_FILES.join(" and ")}`,
    );
  return {
    ...config,
    data: resolve(base, config.data),
    cassettes: resolve(base, config.cassettes),
    ...(config.script === undefined ? {} : { script: resolve(base, config.script) }),
  };
}

/** The set files whose hashes an experiment config pins: what the run reads. */
export const PINNED_FILES = ["policy.json", "states.jsonl"] as const;

/** The set's files the config pins, checked; a file missing or different throws. */
export async function checkSetHashes(config: FaultSetLintConfig): Promise<void> {
  for (const [file, expected] of Object.entries(config.sha256 ?? {})) {
    const path = join(config.data, file);
    const hash = createHash("sha256");
    try {
      for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
    } catch {
      throw new Error(
        `config ${config.name}: ${path} is missing; build the set first (research/scripts/h3_fault_set.py)`,
      );
    }
    if (hash.digest("hex") !== expected)
      throw new Error(`config ${config.name}: ${path} differs from its pinned sha256 ${expected}`);
  }
}

/** Read a config file; its paths are resolved against the file's directory. */
export const readFaultSetConfig = (path: string): FaultSetLintConfig =>
  parseFaultSetConfig(JSON.parse(readFileSync(path, "utf8")), dirname(resolve(path)));

/**
 * The lines of a JSON Lines file, split on the newline byte only, as
 * packages/bench/scripts/fault-set-check.ts reads a set: LongMemEval's text
 * holds U+2028, which node:readline treats as a line end.
 */
export async function* jsonLines(path: string): AsyncGenerator<string> {
  let rest = Buffer.alloc(0);
  for await (const chunk of createReadStream(path)) {
    let buf = Buffer.concat([rest, chunk as Buffer]);
    let nl = buf.indexOf(0x0a);
    while (nl !== -1) {
      const line = buf.subarray(0, nl).toString("utf8");
      if (line.trim() !== "") yield line;
      buf = buf.subarray(nl + 1);
      nl = buf.indexOf(0x0a);
    }
    rest = buf;
  }
  if (rest.toString("utf8").trim() !== "") yield rest.toString("utf8");
}

/** The set's lint-time policy. */
export const readSetPolicy = (dir: string): Policy =>
  Policy.parse(JSON.parse(readFileSync(join(dir, "policy.json"), "utf8")));

/**
 * The set's states in file order: those at positions [from, to) (half open),
 * and of them those `questions` names when given. A state outside the range
 * is not parsed.
 */
export async function* readSetStates(
  dir: string,
  range: { from?: number; to?: number; questions?: readonly string[] | "all" } = {},
): AsyncGenerator<FaultState> {
  const from = range.from ?? 0;
  const to = range.to ?? Number.POSITIVE_INFINITY;
  const wanted =
    range.questions === undefined || range.questions === "all" ? null : new Set(range.questions);
  let i = 0;
  for await (const line of jsonLines(join(dir, "states.jsonl"))) {
    const at = i++;
    if (at < from) continue;
    if (at >= to) break;
    const state = JSON.parse(line) as FaultState;
    if (wanted === null || wanted.has(state.question_id)) yield state;
  }
}

/**
 * A LongMemEval item as card B5 writes it: its ref names a session and turn
 * (packages/bench/src/longmemeval/plane.ts). The generator never writes one;
 * packages/bench/scripts/fault-set-check.ts tells base items apart the same way.
 */
export const isBaseItem = (item: MemoryItem) => item.provenance.ref.startsWith("longmemeval:");

/** One finding, as the scorers read it. */
export interface SetFinding {
  tier: LintFinding["tier"];
  lint_id: string;
  item_id: string;
  /** Whether the item is one of LongMemEval's own (base) items, not one the generator wrote. */
  base: boolean;
}

/** One model unit and what its reply said. */
export interface SetJudgment {
  unit: string;
  lint_id: string;
  item_id: string;
  other_id: string;
  outcome: string;
}

/** One unit card L3's lints would send, with the characters of its system prompt and input. */
export interface PlannedUnit {
  unit: string;
  lint_id: string;
  item_id: string;
  other_id: string;
  chars: number;
}

/** One state linted, deterministic tier only, with the units the model tier would send. */
export interface FloorRow {
  question_id: string;
  findings: SetFinding[];
  planned: PlannedUnit[];
}

/** One state linted at one seed with both tiers. */
export interface ModelRow {
  question_id: string;
  seed: number;
  model: string;
  findings: SetFinding[];
  judgments: SetJudgment[];
}

/** The planning model and seed of a count: the request text does not depend on them. */
const PLAN_SETUP = { model: "none/none", seed: 0 };

function openState(state: FaultState, policy: Policy, lintModel?: ModelLintDep) {
  const db = openSqlite(":memory:");
  migrate(db);
  for (const { seq: _seq, ...e } of state.events) appendEvent(db, e);
  const plane = createPlane({
    db,
    adapter: createFakeAdapter(),
    policy,
    newId: sequentialIds(),
    ...(lintModel === undefined ? {} : { lintModel }),
  });
  return { db, plane };
}

interface ModelLintDep {
  call: ModelCall;
  model: string;
  seed: number;
}

function planned(
  db: ReturnType<typeof openSqlite>,
  state: FaultState,
  policy: Policy,
): PlannedUnit[] {
  return state.scopes.flatMap((scope) =>
    planModelLints({ db, policy }, state.actor, state.at, scope, PLAN_SETUP).map((u) => ({
      unit: u.unit,
      lint_id: u.lint_id,
      item_id: u.item_id,
      other_id: u.other_id,
      chars:
        (u.request.system?.length ?? 0) +
        u.request.messages.reduce((n, m) => n + m.content.length, 0),
    })),
  );
}

async function lintAll(
  plane: ReturnType<typeof createPlane>,
  db: ReturnType<typeof openSqlite>,
  state: FaultState,
) {
  const findings: Omit<SetFinding, "base">[] = [];
  const judgments: SetJudgment[] = [];
  for (const scope of state.scopes) {
    const report = await plane.lint(state.actor, state.at, scope);
    if (report.decision !== "allow")
      throw new Error(`${state.question_id}: the set's actor may not lint ${scope}`);
    for (const f of report.findings)
      findings.push({ tier: f.tier, lint_id: f.lint_id, item_id: f.item_id });
    for (const j of report.judgments ?? [])
      judgments.push({
        unit: j.unit,
        lint_id: j.lint_id,
        item_id: j.item_id,
        other_id: j.other_id,
        outcome: j.outcome,
      });
  }
  const items = new Map(currentItems(db).map((i) => [i.id, i]));
  return {
    findings: findings.map((f) => {
      const item = items.get(f.item_id);
      return {
        tier: f.tier,
        lint_id: f.lint_id,
        item_id: f.item_id,
        base: item !== undefined && isBaseItem(item),
      };
    }),
    judgments,
  };
}

/** One state, card L1's lints only, and the units card L3's would send. No model is called. */
export async function lintFaultStateDeterministic(
  state: FaultState,
  policy: Policy,
): Promise<FloorRow> {
  const { db, plane } = openState(state, policy);
  try {
    const plan = planned(db, state, policy);
    const { findings } = await lintAll(plane, db, state);
    return { question_id: state.question_id, findings, planned: plan };
  } finally {
    db.close();
  }
}

/** One state, both tiers, with `lintModel`. */
export async function lintFaultStateWithModel(
  state: FaultState,
  policy: Policy,
  lintModel: ModelLintDep,
): Promise<ModelRow> {
  const { db, plane } = openState(state, policy, lintModel);
  try {
    const { findings, judgments } = await lintAll(plane, db, state);
    return {
      question_id: state.question_id,
      seed: lintModel.seed,
      model: lintModel.model,
      findings,
      judgments,
    };
  } finally {
    db.close();
  }
}

/** The cache context of every lint call on one question. */
export const faultSetContext = (questionId: string, policy: Policy): CallContext => ({
  item: `fault-set/${questionId}`,
  condition: "lint",
  preset: policy.id,
  store: NO_STORE,
});

export interface FaultSetRunOptions {
  cache?: CacheStore;
  /** Refuse misses; unset means ENGRAM_OFFLINE=1 decides (see `cached`). */
  offline?: boolean;
  live?: LiveModels;
}

/** The uncached lint call: the script for a scripted model, a live model when given, else none. */
function innerCall(config: FaultSetLintConfig, live: LiveModels | undefined): ModelCall {
  if (config.model.startsWith("scripted/"))
    return scriptedLintCall(
      LintScript.parse(JSON.parse(readFileSync(config.script as string, "utf8"))),
    );
  if (live) return liveJudgeCall(live);
  return async (request) => {
    throw new Error(`no live model ${request.model} to answer a cache miss`);
  };
}

export interface FaultSetRunResult {
  config: string;
  rows: ModelRow[];
  /** Per seed: units by outcome. */
  summary: Record<string, Record<string, number>>;
  calls: { new: number; cached: number };
  usage: UsageRecord[];
}

/** Every named state at every seed, both tiers, through the config's cassettes. */
export async function runFaultSetConfig(
  config: FaultSetLintConfig,
  options: FaultSetRunOptions = {},
): Promise<FaultSetRunResult> {
  await checkSetHashes(config);
  const policy = readSetPolicy(config.data);
  const cache = options.cache ?? fileCache(config.cassettes);
  const inner = innerCall(config, options.live);
  const usage: UsageRecord[] = [];
  const rows: ModelRow[] = [];
  const seen = new Set<string>();
  for await (const state of readSetStates(config.data, { questions: config.questions })) {
    seen.add(state.question_id);
    for (const seed of config.seeds) {
      const call = cached(inner, {
        cache,
        context: faultSetContext(state.question_id, policy),
        ...(options.offline === undefined ? {} : { offline: options.offline }),
        onUsage: (u) => usage.push(u),
      });
      rows.push(await lintFaultStateWithModel(state, policy, { call, model: config.model, seed }));
    }
  }
  if (config.questions !== "all") {
    const missing = config.questions.filter((q) => !seen.has(q));
    if (missing.length > 0)
      throw new Error(`config ${config.name}: no state for ${missing.join(", ")}`);
  }
  const summary: FaultSetRunResult["summary"] = {};
  for (const r of rows) {
    const counts = summary[String(r.seed)] ?? { flag: 0, pass: 0, refused: 0, malformed: 0 };
    summary[String(r.seed)] = counts;
    for (const j of r.judgments) counts[j.outcome] = (counts[j.outcome] ?? 0) + 1;
  }
  return {
    config: config.name,
    rows,
    summary,
    calls: { new: usage.filter((u) => !u.hit).length, cached: usage.filter((u) => u.hit).length },
    usage,
  };
}

/** results.jsonl, summary.json and usage.json, as the other runners write them. */
export function writeFaultSetResult(result: FaultSetRunResult, out: string): void {
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, "results.jsonl"),
    result.rows.map((r) => `${JSON.stringify(r)}\n`).join(""),
  );
  const { config, summary, calls, usage } = result;
  writeFileSync(join(out, "summary.json"), `${JSON.stringify({ config, summary }, null, 2)}\n`);
  writeFileSync(join(out, "usage.json"), `${JSON.stringify({ config, calls, usage }, null, 2)}\n`);
}

export interface FaultSetCount {
  config: string;
  kind: FaultSetLintConfig["kind"];
  benchmark: typeof FAULT_SET_BENCHMARK;
  model: string;
  /** The set directory, relative to the repository when inside it. */
  data: string;
  /** States counted. */
  questions: number;
  seeds: number[];
  /** Calls per lint, one seed. */
  per_lint: Record<string, number>;
  /** Characters of the system prompt and input across every unit, one seed. */
  request_chars: number;
  per_seed: number;
  calls: number;
}

/**
 * What a fault-set config would call, without calling: every state's units
 * (planModelLints, as Plane.lint would choose them), times the seeds. No
 * model is called and no cassette is read or written.
 */
export async function countFaultSetConfig(
  config: FaultSetLintConfig,
  repo: string,
): Promise<FaultSetCount> {
  await checkSetHashes(config);
  const policy = readSetPolicy(config.data);
  const per_lint: Record<string, number> = {};
  let request_chars = 0;
  let questions = 0;
  for await (const state of readSetStates(config.data, { questions: config.questions })) {
    questions++;
    const { db } = openState(state, policy);
    try {
      for (const u of planned(db, state, policy)) {
        per_lint[u.lint_id] = (per_lint[u.lint_id] ?? 0) + 1;
        request_chars += u.chars;
      }
    } finally {
      db.close();
    }
  }
  const per_seed = Object.values(per_lint).reduce((a, b) => a + b, 0);
  const rel = relative(repo, config.data).replaceAll("\\", "/");
  return {
    config: config.name,
    kind: config.kind,
    benchmark: FAULT_SET_BENCHMARK,
    model: config.model,
    data: rel.startsWith("..") ? config.data : rel,
    questions,
    seeds: [...config.seeds],
    per_lint: Object.fromEntries(Object.entries(per_lint).sort(([a], [b]) => (a < b ? -1 : 1))),
    request_chars,
    per_seed,
    calls: per_seed * config.seeds.length,
  };
}

/** The count as the lines `make run ... COUNT=1` prints. */
export function faultSetCountLines(count: FaultSetCount): string[] {
  return [
    `${count.config}: ${count.kind} config, benchmark ${count.benchmark}, model ${count.model}`,
    `data ${count.data}: ${count.questions} states`,
    `calls: ${count.calls} = ${count.per_seed} per seed x ${count.seeds.length} seeds (${count.seeds.join(", ")})`,
    ...Object.entries(count.per_lint).map(([l, n]) => `  ${l}: ${n} calls per seed`),
    `prompt characters: ${count.request_chars} per seed`,
    "no model was called; no cassette was read or written",
  ];
}
