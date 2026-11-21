// The induction run (card D2): recorded pi sessions in, candidate procedures
// out, written through Plane.write (AGENTS.md rule 2). Core's induction
// (packages/core/src/distill/induce.ts) gets its ModelCall here, from
// @engram/model's cache: every call is seeded from the config (rule 6) and
// keyed on (`distill/<data folder>`, the method, `none`, `none`, model, seed,
// prompt hash) (rule 7, ADR 0017), so a rerun makes zero new calls. The
// preset is not in the key, since it changes no prompt.
//
// For each seed a fresh log and fake store under the config's preset: each
// method (`awm`, the port of Agent Workflow Memory; `rule`, its control that
// calls no model) induces from the config's sessions, and every candidate is
// written as its own scope's owner, with the source the candidate's
// provenance names (the least trusted of its inputs, ADR 0004).
//
// A pipeline config runs a scripted induction model (`script`: one reply
// for every seed, or for the seeds it names), recorded into committed
// cassettes by `make fixtures`; `make run` replays them, a miss an error.
// The script answers only the request the induction would send for the
// config's sessions at that seed (its hash), and fails loudly on any other.
// No experiment config exists yet: H5's live induction is card X11.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { createFakeAdapter } from "@engram/adapters";
import {
  type Actor,
  awmRequest,
  type CandidateFrame,
  createPlane,
  INDUCTION_METHODS,
  type InductionReport,
  induceAwm,
  induceByRule,
  loadPreset,
  type MemoryEvent,
  type MemoryItem,
  type ModelCall,
  migrate,
  openSqlite,
  PRESETS,
  parseSessionJsonl,
  parseSkillMd,
  prepareSessions,
  requestHash,
  Scope,
  type Session,
  toSkillMd,
} from "@engram/core";
import {
  type CacheStore,
  type CallContext,
  cached,
  fileCache,
  scriptedModelCall,
  type UsageRecord,
} from "@engram/model";
import { z } from "zod";
import { NO_STORE } from "./config.ts";
import { sequentialIds } from "./gatemem-probe.ts";

export const INDUCE_BENCHMARK = "distill";
/** The time every candidate is written at: fixed, so a rerun writes the same log (core reads no clock). */
export const INDUCE_AT = "2026-11-21T12:00:00.000Z";

const unique = <T>(values: readonly T[]) => new Set(values).size === values.length;

export const InduceRunnerConfig = z.strictObject({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  /** Only pipeline configs exist: H5's live induction is card X11. */
  kind: z.literal("pipeline"),
  benchmark: z.literal(INDUCE_BENCHMARK),
  /** A folder of pi session files (`.jsonl`). */
  data: z.string(),
  /** Session file names, or `all`: every `.jsonl` in `data`, by name. */
  items: z.union([
    z.literal("all"),
    z.array(z.string().min(1)).min(1).refine(unique, "items must be unique"),
  ]),
  /** Which inductions run, in this order. */
  methods: z.array(z.enum(INDUCTION_METHODS)).min(1).refine(unique, "methods must be unique"),
  /** `provider/model-id` of the AWM induction; `scripted/<id>` answers from `script`. */
  model: z.string().regex(/^[^/\s]+\/\S+$/, "model must be provider/model-id"),
  seeds: z.array(z.number().int()).min(1).refine(unique, "seeds must be unique"),
  /** The policy preset the candidates' writes are judged under. */
  preset: z.enum(PRESETS),
  /**
   * The person scope the candidates are written into; its owner writes them.
   * A person scope, since no preset lets model or compaction content leave
   * one (ADR 0004, 0007).
   */
  scope: Scope.refine((s) => s.startsWith("person:"), "candidates are written into a person scope"),
  script: z.string().optional(),
  cassettes: z.string(),
});
export type InduceRunnerConfig = z.infer<typeof InduceRunnerConfig>;

/** Whether the JSON config at `path` is an induction config. */
export function isInduceConfig(path: string): boolean {
  const raw = JSON.parse(readFileSync(path, "utf8")) as { benchmark?: unknown };
  return raw.benchmark === INDUCE_BENCHMARK;
}

export function parseInduceConfig(value: unknown, base = process.cwd()): InduceRunnerConfig {
  const config = InduceRunnerConfig.parse(value);
  if (config.model.startsWith("scripted/") && config.script === undefined)
    throw new Error(`config ${config.name}: a scripted model needs a script`);
  return {
    ...config,
    data: resolve(base, config.data),
    cassettes: resolve(base, config.cassettes),
    ...(config.script === undefined ? {} : { script: resolve(base, config.script) }),
  };
}

/** Read a config file; its paths are resolved against the file's directory. */
export const readInduceConfig = (path: string): InduceRunnerConfig =>
  parseInduceConfig(JSON.parse(readFileSync(path, "utf8")), dirname(resolve(path)));

/** The config's sessions, in its order, as the Distiller takes them, with each file's name. */
export function loadSessions(config: Pick<InduceRunnerConfig, "data" | "items" | "name">) {
  const files =
    config.items === "all"
      ? readdirSync(config.data)
          .filter((f) => f.endsWith(".jsonl"))
          .sort()
      : [...config.items];
  if (files.length === 0) throw new Error(`config ${config.name}: no session in ${config.data}`);
  return files.map((file) => {
    const parsed = parseSessionJsonl(readFileSync(join(config.data, file), "utf8"));
    const session: Session = { id: parsed.id, entries: parsed.entries };
    return { file, session };
  });
}

/** The cache context of an induction call: the session folder and the method. */
export const induceContext = (config: Pick<InduceRunnerConfig, "data">): CallContext => ({
  item: `distill/${basename(config.data)}`,
  condition: "awm",
  preset: "none",
  store: NO_STORE,
});

/** A scripted induction model's replies: one for every seed, or for the seeds named. */
export const InduceScript = z.strictObject({
  _comment: z.string().optional(),
  replies: z.array(
    z.strictObject({ seeds: z.array(z.number().int()).min(1).optional(), reply: z.string() }),
  ),
});
export type InduceScript = z.infer<typeof InduceScript>;

/**
 * The scripted induction model: for each seed, the request the AWM induction
 * sends for `sessions` (awmRequest), answered with the script's reply for
 * that seed; any other request fails loudly (scriptedModelCall).
 */
export function scriptedInduceCall(
  script: InduceScript,
  sessions: readonly Session[],
  config: Pick<InduceRunnerConfig, "model" | "seeds">,
): ModelCall {
  const { examples } = prepareSessions(sessions);
  const table: Record<string, string> = {};
  for (const seed of config.seeds) {
    const answers = script.replies.filter((r) => r.seeds === undefined || r.seeds.includes(seed));
    const named = answers.filter((r) => r.seeds !== undefined);
    const chosen = named.length > 0 ? named : answers;
    if (chosen.length > 1) throw new Error(`the induction script answers seed ${seed} twice`);
    const reply = chosen[0];
    if (reply === undefined) continue;
    table[requestHash(awmRequest(examples, { model: config.model, seed }))] = reply.reply;
  }
  return scriptedModelCall(table);
}

export interface InduceRunnerOptions {
  cache?: CacheStore;
  /** Refuse misses; unset means ENGRAM_OFFLINE=1 decides (see `cached`). */
  offline?: boolean;
}

/** One candidate as the run reports it. */
export interface InducedCandidate {
  title: string;
  status: "candidate" | "rejected";
  reason?: string;
  item_id?: string;
  skill_name?: string;
  tools?: string[];
  /** The write's decision and why. */
  write?: { decision: string; reason: string; policy_id: string };
}

/** One method at one seed. */
export interface InduceRow {
  config: string;
  method: (typeof INDUCTION_METHODS)[number];
  seed: number;
  /** The model the AWM induction called; null for the control. */
  model: string | null;
  preset: string;
  examples: { file: string; session_id: string; task_id: string | null }[];
  skipped: { file: string; session_id: string; reason: string }[];
  sequence?: { tools: string[]; support: number } | null;
  /** Characters of the induction prompt (awm). */
  prompt_chars?: number;
  candidates: InducedCandidate[];
}

export interface InduceRunnerResult {
  config: string;
  rows: InduceRow[];
  /** Every candidate the plane admitted, as stored, by method and seed. */
  items: { method: string; seed: number; item: MemoryItem; skill_md: string }[];
  /** The plane's log of each seed. */
  events: { seed: number; events: MemoryEvent[] }[];
  summary: Record<
    string,
    { candidates: number; rejected: number; written: number; denied: number }
  >;
  calls: { new: number; cached: number };
  usage: UsageRecord[];
}

/** The uncached induction call: the script for a scripted model, else none. */
function innerCall(config: InduceRunnerConfig, sessions: readonly Session[]): ModelCall {
  if (config.model.startsWith("scripted/"))
    return scriptedInduceCall(
      InduceScript.parse(JSON.parse(readFileSync(config.script as string, "utf8"))),
      sessions,
      config,
    );
  return async (request) => {
    throw new Error(
      `no live model ${request.model} to answer a cache miss; H5's live induction is card X11`,
    );
  };
}

export async function runInduceConfig(
  config: InduceRunnerConfig,
  options: InduceRunnerOptions = {},
): Promise<InduceRunnerResult> {
  const loaded = loadSessions(config);
  const sessions = loaded.map((l) => l.session);
  const fileOf = new Map(loaded.map((l) => [l.session.id, l.file]));
  const cache = options.cache ?? fileCache(config.cassettes);
  const usage: UsageRecord[] = [];
  const onUsage = (u: UsageRecord) => usage.push(u);
  const call = cached(innerCall(config, sessions), {
    cache,
    context: induceContext(config),
    ...(options.offline === undefined ? {} : { offline: options.offline }),
    onUsage,
  });
  const policy = loadPreset(config.preset);
  const rows: InduceRow[] = [];
  const items: InduceRunnerResult["items"] = [];
  const events: InduceRunnerResult["events"] = [];
  for (const seed of config.seeds) {
    const db = openSqlite(":memory:");
    try {
      migrate(db);
      const newId = sequentialIds();
      const plane = createPlane({ db, adapter: createFakeAdapter(), policy, newId });
      const at = INDUCE_AT;
      const frame: CandidateFrame = {
        scope: config.scope,
        owner: config.scope,
        actor: config.scope,
        at,
        newId,
      };
      for (const method of config.methods) {
        const report: InductionReport =
          method === "awm"
            ? await induceAwm(sessions, { model: config.model, seed }, call, frame)
            : induceByRule(sessions, frame);
        const candidates: InducedCandidate[] = [];
        for (const w of report.workflows) {
          if (w.status === "rejected") {
            candidates.push({ title: w.title, status: "rejected", reason: w.reason });
            continue;
          }
          const actor: Actor = {
            id: config.scope,
            level: "person",
            memberships: [config.scope],
            source: w.item.provenance.kind,
          };
          const written = await plane.write(actor, w.item, at);
          const skill = toSkillMd(w.item);
          candidates.push({
            title: w.title,
            status: "candidate",
            item_id: w.item.id,
            skill_name: parseSkillMd(skill).name,
            tools: [...(w.item.content as { tools: string[] }).tools],
            write: {
              decision: written.event.decision,
              reason: written.event.reason,
              policy_id: written.event.policy_id,
            },
          });
          if (written.item)
            items.push({ method, seed, item: written.item, skill_md: toSkillMd(written.item) });
        }
        rows.push({
          config: config.name,
          method,
          seed,
          model: method === "awm" ? config.model : null,
          preset: config.preset,
          examples: report.examples.map((e) => ({
            file: fileOf.get(e.session_id) as string,
            ...e,
          })),
          skipped: report.skipped.map((s) => ({ file: fileOf.get(s.session_id) as string, ...s })),
          ...(report.sequence === undefined ? {} : { sequence: report.sequence }),
          ...(report.request === undefined
            ? {}
            : { prompt_chars: report.request.messages.reduce((n, m) => n + m.content.length, 0) }),
          candidates,
        });
      }
      events.push({ seed, events: plane.events() });
    } finally {
      db.close();
    }
  }
  const summary: InduceRunnerResult["summary"] = {};
  for (const r of rows) {
    const c = r.candidates;
    summary[`${r.method}@${r.seed}`] = {
      candidates: c.filter((x) => x.status === "candidate").length,
      rejected: c.filter((x) => x.status === "rejected").length,
      written: c.filter((x) => x.write?.decision === "allow").length,
      denied: c.filter((x) => x.write !== undefined && x.write.decision !== "allow").length,
    };
  }
  return {
    config: config.name,
    rows,
    items,
    events,
    summary,
    calls: { new: usage.filter((u) => !u.hit).length, cached: usage.filter((u) => u.hit).length },
    usage,
  };
}

/**
 * results.jsonl, candidates.jsonl (each stored candidate with its SKILL.md),
 * events.jsonl, summary.json and usage.json in `out`, and each candidate's
 * SKILL.md under skills/<method>-seed-<seed>/<name>/, as a harness loads it.
 */
export function writeInduceResult(result: InduceRunnerResult, out: string): void {
  mkdirSync(out, { recursive: true });
  const lines = (values: readonly unknown[]) =>
    values.map((v) => `${JSON.stringify(v)}\n`).join("");
  writeFileSync(join(out, "results.jsonl"), lines(result.rows));
  writeFileSync(join(out, "candidates.jsonl"), lines(result.items));
  writeFileSync(
    join(out, "events.jsonl"),
    lines(result.events.flatMap((s) => s.events.map((e) => ({ seed: s.seed, ...e })))),
  );
  for (const { method, seed, skill_md } of result.items) {
    const dir = join(out, "skills", `${method}-seed-${seed}`, parseSkillMd(skill_md).name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), skill_md);
  }
  const { config, summary, calls, usage } = result;
  writeFileSync(join(out, "summary.json"), `${JSON.stringify({ config, summary }, null, 2)}\n`);
  writeFileSync(join(out, "usage.json"), `${JSON.stringify({ config, calls, usage }, null, 2)}\n`);
}

export interface InduceCount {
  config: string;
  benchmark: typeof INDUCE_BENCHMARK;
  model: string;
  data: string;
  sessions: number;
  examples: number;
  seeds: number[];
  methods: string[];
  /** Characters of the induction prompt, one seed. */
  prompt_chars: number;
  calls: number;
}

/** What an induction config would call, without calling: one AWM call per seed when any session is an example. */
export function countInduceConfig(config: InduceRunnerConfig, repo: string): InduceCount {
  const sessions = loadSessions(config).map((l) => l.session);
  const { examples } = prepareSessions(sessions);
  const awm = config.methods.includes("awm") && examples.length > 0;
  const request = awmRequest(examples, { model: config.model, seed: config.seeds[0] as number });
  const rel = relative(repo, config.data).replaceAll("\\", "/");
  return {
    config: config.name,
    benchmark: INDUCE_BENCHMARK,
    model: config.model,
    data: rel.startsWith("..") ? config.data : rel,
    sessions: sessions.length,
    examples: examples.length,
    seeds: [...config.seeds],
    methods: [...config.methods],
    prompt_chars: awm ? request.messages.reduce((n, m) => n + m.content.length, 0) : 0,
    calls: awm ? config.seeds.length : 0,
  };
}
