// The model-based lints on a fault set (card L3): each fault fixture
// (packages/core/scripts/faults.ts, under fixtures/faults/model/) is loaded
// into a fresh log, and Plane.lint runs on it with a lint model per seed; the
// lint model is the config's model behind @engram/model's cache, so every
// call is seeded and keyed on (fixture, `lint`, the fixture's policy, `none`,
// model, seed, prompt hash) (ADR 0017, AGENTS.md rule 7). A replay makes zero
// new calls. The rows carry what the plane found and what every unit's reply
// said, and the fixture's labels beside them for the analysis
// (research/scripts/l3_variance.py), which alone reads them: no label reaches
// a prompt or the plane.
//
// A pipeline config runs a scripted lint model (`script`, replies keyed on
// the input the lint sent, optionally per seed) recorded into committed
// cassettes by `make fixtures`; an experiment config (the L3 pilot) runs on a
// named live model, through the runner's seeded chat-completions call
// (judge.ts liveJudgeCall, which sends the response schema), or is counted.
// Until card L2's seeded-fault set lands, the fault set is L3's own model
// fault catalogue.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { createFakeAdapter } from "@engram/adapters";
import {
  ActorShape,
  appendEvent,
  canonicalJson,
  createPlane,
  isModelLint,
  MemoryEvent,
  type ModelCall,
  migrate,
  openSqlite,
  Policy,
  planModelLints,
} from "@engram/core";
import { type CacheStore, type CallContext, fileCache, type UsageRecord } from "@engram/model";
import { z } from "zod";
import type { LiveModels } from "./answers.ts";
import { NO_STORE } from "./config.ts";
import { sequentialIds } from "./gatemem-probe.ts";
import { cachedJudgeCall, liveJudgeCall } from "./judge.ts";

export const LINT_BENCHMARK = "lint-faults";

const unique = <T>(values: readonly T[]) => new Set(values).size === values.length;

export const LintRunnerConfig = z.strictObject({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  /** As every runner config: `pipeline` on a scripted model, `experiment` on a named live one. */
  kind: z.enum(["pipeline", "experiment"]),
  benchmark: z.literal(LINT_BENCHMARK),
  /** A directory of fault fixtures (FaultFixture files). */
  data: z.string(),
  /** Fixture names (file names without `.json`), or `all`: every model-lint fixture in `data`. */
  items: z.union([
    z.literal("all"),
    z.array(z.string().min(1)).min(1).refine(unique, "items must be unique"),
  ]),
  /** `provider/model-id`; `scripted/<id>` answers misses from `script`. */
  model: z.string().regex(/^[^/\s]+\/\S+$/, "model must be provider/model-id"),
  seeds: z.array(z.number().int()).min(1).refine(unique, "seeds must be unique"),
  script: z.string().optional(),
  cassettes: z.string(),
});
export type LintRunnerConfig = z.infer<typeof LintRunnerConfig>;

/** A fault fixture file, as packages/core/scripts/faults.ts writes it. */
export const FaultFixtureFile = z.strictObject({
  description: z.string(),
  lint_id: z.string(),
  kind: z.enum(["flag", "near-miss"]),
  policy: Policy,
  actor: ActorShape,
  scope: z.string(),
  at: z.string(),
  events: z.array(MemoryEvent),
  flags: z.array(z.string()),
  units: z
    .array(z.strictObject({ unit: z.string(), verdict: z.enum(["flag", "pass"]) }))
    .optional(),
});
export type FaultFixtureFile = z.infer<typeof FaultFixtureFile>;

/** Whether the JSON config at `path` names the lint fault set. */
export function isLintConfig(path: string): boolean {
  const raw = JSON.parse(readFileSync(path, "utf8")) as { benchmark?: unknown };
  return raw.benchmark === LINT_BENCHMARK;
}

export function parseLintConfig(value: unknown, base = process.cwd()): LintRunnerConfig {
  const config = LintRunnerConfig.parse(value);
  const scripted = config.model.startsWith("scripted/");
  if (scripted && config.script === undefined)
    throw new Error(`config ${config.name}: a scripted model needs a script`);
  if (config.kind === "experiment" && (scripted || config.script !== undefined))
    throw new Error(
      `config ${config.name}: an experiment runs on a live model, never a scripted one or a script`,
    );
  return {
    ...config,
    data: resolve(base, config.data),
    cassettes: resolve(base, config.cassettes),
    ...(config.script === undefined ? {} : { script: resolve(base, config.script) }),
  };
}

/** Read a config file; its paths are resolved against the file's directory. */
export const readLintConfig = (path: string): LintRunnerConfig =>
  parseLintConfig(JSON.parse(readFileSync(path, "utf8")), dirname(resolve(path)));

export interface LoadedFixture {
  name: string;
  /** sha256 of the file as committed, so a count names the exact set. */
  sha256: string;
  fixture: FaultFixtureFile;
}

/** The config's fixtures, in its order (`all`: every model-lint fixture, by name). */
export function loadFaultFixtures(config: Pick<LintRunnerConfig, "data" | "items" | "name">) {
  const read = (name: string): LoadedFixture => {
    const text = readFileSync(join(config.data, `${name}.json`), "utf8").replaceAll("\r\n", "\n");
    return {
      name,
      sha256: createHash("sha256").update(text).digest("hex"),
      fixture: FaultFixtureFile.parse(JSON.parse(text)),
    };
  };
  const names =
    config.items === "all"
      ? readdirSync(config.data)
          .filter((f) => f.endsWith(".json"))
          .map((f) => f.replace(/\.json$/, ""))
          .sort()
      : [...config.items];
  const loaded = names.map(read);
  const all = config.items === "all";
  const out = all ? loaded.filter((l) => isModelLint(l.fixture.lint_id)) : loaded;
  for (const l of out)
    if (!isModelLint(l.fixture.lint_id))
      throw new Error(
        `config ${config.name}: fixture ${l.name} is for ${l.fixture.lint_id}, not a model-based lint`,
      );
  if (out.length === 0)
    throw new Error(`config ${config.name}: no model-lint fixture in ${config.data}`);
  return out;
}

/** The cache context of every lint call on one fixture. */
export const lintContext = (f: LoadedFixture): CallContext => ({
  item: `faults/${f.name}`,
  condition: "lint",
  preset: f.fixture.policy.id,
  store: NO_STORE,
});

/** A scripted lint model's replies: for an input the lint sends, its reply, for every seed or the ones named. */
export const LintScript = z.strictObject({
  _comment: z.string().optional(),
  replies: z.array(
    z.strictObject({
      input: z.record(z.string(), z.unknown()),
      seeds: z.array(z.number().int()).min(1).optional(),
      reply: z.string(),
    }),
  ),
});
export type LintScript = z.infer<typeof LintScript>;

/**
 * A ModelCall answering each lint request from the script: the entry whose
 * input equals the request's (its one user message, as JSON) and names its
 * seed, else the one for every seed. A request the script does not answer,
 * or answers twice, fails loudly.
 */
export function scriptedLintCall(script: LintScript): ModelCall {
  const table = new Map<string, Map<number | "any", string>>();
  for (const r of script.replies) {
    const key = canonicalJson(r.input);
    const bySeed = table.get(key) ?? new Map<number | "any", string>();
    for (const seed of r.seeds ?? ["any" as const]) {
      if (bySeed.has(seed))
        throw new Error(`lint script answers ${key} twice for seed ${String(seed)}`);
      bySeed.set(seed, r.reply);
    }
    table.set(key, bySeed);
  }
  return async (request) => {
    const key = canonicalJson(JSON.parse(request.messages.at(-1)?.content ?? "null"));
    const bySeed = table.get(key);
    const text = bySeed?.get(request.seed) ?? bySeed?.get("any");
    if (text === undefined)
      throw new Error(`the lint script has no reply for ${key} (seed ${request.seed})`);
    return { text, usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 } };
  };
}

export interface LintRunnerOptions {
  cache?: CacheStore;
  /** Refuse misses; unset means ENGRAM_OFFLINE=1 decides (see `cached`). */
  offline?: boolean;
  live?: LiveModels;
}

/** The uncached lint call: the script for a scripted model, a live model when given, else none. */
function innerCall(config: LintRunnerConfig, live: LiveModels | undefined): ModelCall {
  if (config.model.startsWith("scripted/"))
    return scriptedLintCall(
      LintScript.parse(JSON.parse(readFileSync(config.script as string, "utf8"))),
    );
  if (live) return liveJudgeCall(live);
  return async (request) => {
    throw new Error(`no live model ${request.model} to answer a cache miss`);
  };
}

/** One fixture linted at one seed. */
export interface LintRow {
  item: string;
  fixture: string;
  lint_id: string;
  kind: "flag" | "near-miss";
  seed: number;
  model: string;
  /** The fixture's labels: the items a correct judge flags, and each unit's correct verdict. */
  labels: { flags: string[]; units: { unit: string; verdict: "flag" | "pass" }[] };
  findings: { lint_id: string; item_id: string; evidence: string[] }[];
  judgments: {
    unit: string;
    lint_id: string;
    item_id: string;
    other_id: string;
    outcome: string;
    reason: string | null;
  }[];
}

export interface LintRunnerResult {
  config: string;
  rows: LintRow[];
  /** Per fixture and seed: units by outcome. */
  summary: Record<string, Record<string, number>>;
  calls: { new: number; cached: number };
  usage: UsageRecord[];
}

export async function runLintConfig(
  config: LintRunnerConfig,
  options: LintRunnerOptions = {},
): Promise<LintRunnerResult> {
  const fixtures = loadFaultFixtures(config);
  const cache = options.cache ?? fileCache(config.cassettes);
  const inner = innerCall(config, options.live);
  const usage: UsageRecord[] = [];
  const rows: LintRow[] = [];
  for (const loaded of fixtures) {
    const f = loaded.fixture;
    for (const seed of config.seeds) {
      const db = openSqlite(":memory:");
      try {
        migrate(db);
        const plane = createPlane({
          db,
          adapter: createFakeAdapter(),
          policy: f.policy,
          newId: sequentialIds(),
          lintModel: {
            call: cachedJudgeCall(inner, {
              cache,
              context: lintContext(loaded),
              ...(options.offline === undefined ? {} : { offline: options.offline }),
              onUsage: (u) => usage.push(u),
            }),
            model: config.model,
            seed,
          },
        });
        for (const { seq: _seq, ...e } of f.events) appendEvent(db, e);
        const report = await plane.lint(f.actor, f.at, f.scope);
        rows.push({
          item: `faults/${loaded.name}`,
          fixture: loaded.name,
          lint_id: f.lint_id,
          kind: f.kind,
          seed,
          model: config.model,
          labels: { flags: f.flags, units: f.units ?? [] },
          findings: report.findings.map((x) => ({
            lint_id: x.lint_id,
            item_id: x.item_id,
            evidence: x.evidence,
          })),
          judgments: (report.judgments ?? []).map((j) => ({
            unit: j.unit,
            lint_id: j.lint_id,
            item_id: j.item_id,
            other_id: j.other_id,
            outcome: j.outcome,
            reason: j.reason,
          })),
        });
      } finally {
        db.close();
      }
    }
  }
  const summary: LintRunnerResult["summary"] = {};
  for (const r of rows) {
    const counts: Record<string, number> = { flag: 0, pass: 0, refused: 0, malformed: 0 };
    for (const j of r.judgments) counts[j.outcome] = (counts[j.outcome] ?? 0) + 1;
    summary[`${r.fixture}@${r.seed}`] = counts;
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
export function writeLintResult(result: LintRunnerResult, out: string): void {
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, "results.jsonl"),
    result.rows.map((r) => `${JSON.stringify(r)}\n`).join(""),
  );
  const { config, summary, calls, usage } = result;
  writeFileSync(join(out, "summary.json"), `${JSON.stringify({ config, summary }, null, 2)}\n`);
  writeFileSync(join(out, "usage.json"), `${JSON.stringify({ config, calls, usage }, null, 2)}\n`);
}

export interface LintCount {
  config: string;
  kind: LintRunnerConfig["kind"];
  benchmark: typeof LINT_BENCHMARK;
  model: string;
  /** The fixture directory, relative to the repository when inside it. */
  data: string;
  seeds: number[];
  fixtures: {
    name: string;
    sha256: string;
    lint_id: string;
    kind: "flag" | "near-miss";
    units: number;
    /** Characters of the system prompt and the input across the fixture's units, one seed. */
    request_chars: number;
  }[];
  /** Calls per lint, over every seed. */
  per_lint: Record<string, number>;
  /** Calls per seed. */
  per_seed: number;
  calls: number;
}

/**
 * What a lint config would call, without calling: every fixture's units
 * (planModelLints, as Plane.lint would choose them), times the seeds. No
 * model is called and no cassette is read or written.
 */
export function countLintConfig(config: LintRunnerConfig, repo: string): LintCount {
  const fixtures = loadFaultFixtures(config).map((loaded) => {
    const f = loaded.fixture;
    const db = openSqlite(":memory:");
    try {
      migrate(db);
      for (const { seq: _seq, ...e } of f.events) appendEvent(db, e);
      const units = planModelLints({ db, policy: f.policy }, f.actor, f.at, f.scope, {
        model: config.model,
        seed: config.seeds[0] as number,
      });
      return {
        name: loaded.name,
        sha256: loaded.sha256,
        lint_id: f.lint_id,
        kind: f.kind,
        units: units.length,
        request_chars: units.reduce(
          (n, u) =>
            n +
            (u.request.system?.length ?? 0) +
            u.request.messages.reduce((m, x) => m + x.content.length, 0),
          0,
        ),
      };
    } finally {
      db.close();
    }
  });
  const per_lint: Record<string, number> = {};
  for (const f of fixtures)
    per_lint[f.lint_id] = (per_lint[f.lint_id] ?? 0) + f.units * config.seeds.length;
  const per_seed = fixtures.reduce((n, f) => n + f.units, 0);
  const rel = relative(repo, config.data).replaceAll("\\", "/");
  return {
    config: config.name,
    kind: config.kind,
    benchmark: LINT_BENCHMARK,
    model: config.model,
    data: rel.startsWith("..") ? config.data : rel,
    seeds: [...config.seeds],
    fixtures,
    per_lint,
    per_seed,
    calls: per_seed * config.seeds.length,
  };
}

/** The count as the lines `make run ... COUNT=1` prints. */
export function lintCountLines(count: LintCount): string[] {
  return [
    `${count.config}: ${count.kind} config, benchmark ${count.benchmark}, model ${count.model}`,
    `data ${count.data}: ${count.fixtures.length} fault fixtures`,
    ...count.fixtures.map(
      (f) =>
        `  ${f.name} (${f.lint_id}, ${f.kind}, sha256 ${f.sha256.slice(0, 12)}): ${f.units} calls per seed, ${f.request_chars} prompt characters`,
    ),
    `calls: ${count.calls} = ${count.per_seed} per seed x ${count.seeds.length} seeds (${count.seeds.join(", ")})`,
    ...Object.entries(count.per_lint).map(([l, n]) => `  ${l}: ${n} calls`),
    "no model was called; no cassette was read or written",
  ];
}
