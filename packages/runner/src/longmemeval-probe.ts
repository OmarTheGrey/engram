// One LongMemEval question as a pi SDK session (card B5, the engineering
// half), the way B4 runs a MEM-INV-Bench case (mem-inv-probe.ts). The
// question's history is written first: under C5 every turn crosses
// Plane.write into the user's person scope (packages/bench
// longmemeval/plane.ts); under C2 the same items go straight to the store,
// which is what the ungoverned baseline measures. Then the reader prompt is
// the session's prompt, the model reads its memory with memory_read (under C5
// the Plane.read at the question date), and its final reply is the
// hypothesis, which the judge labels (packages/bench longmemeval/judge.ts).
// The model and the plane see only the visible question; the judge and the
// breakdown alone read the labels.
//
// Only C2 and C5 are built here: card B5 asks for the ungoverned baseline and
// card B6 for the enforced one. C1 (long context), C3 and C4 are not built on
// LongMemEval. The live baseline on the primary model waits for the
// pre-registration (AGENTS.md); a pipeline config runs a scripted model and a
// scripted judge, and its numbers are not results.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { longMemEval } from "@engram/bench";
import {
  type Adapter,
  createPlane,
  loadPreset,
  type ModelCall,
  migrate,
  openSqlite,
  type Policy,
  type PresetName,
} from "@engram/core";
import {
  type CacheStore,
  type CallContext,
  cached,
  fileCache,
  type UsageRecord,
} from "@engram/model";
import { ENGRAM_EVENT, type RecallDetails, renderRecall } from "@engram/pi-extension";
import { z } from "zod";
import { answersFor, type LiveModels } from "./answers.ts";
import { conditionSession, type UngovernedStore } from "./conditions.ts";
import {
  CONDITION_TABLE,
  type Condition,
  checkConfig,
  configItems,
  configStores,
  RunnerConfig,
  resolvePaths,
  statedPreset,
} from "./config.ts";
import { MEMORY_BLOCK, sequentialIds } from "./gatemem-probe.ts";
import type { SessionDecision } from "./mem-inv-probe.ts";
import { type AnswerSource, cassettePiModel } from "./model/cassette.ts";
import { closeStore, openStore, type StoreName } from "./stores.ts";

/** The conditions built on LongMemEval: the ungoverned baseline and the enforced one. */
export const LONGMEMEVAL_CONDITIONS = ["C2", "C5"] as const satisfies readonly Condition[];

/**
 * A runner config for LongMemEval: RN1's fields, with this benchmark and a
 * question directory as `data`. The judge is optional for a pipeline config
 * (without one, rows carry no label); an experiment config without one uses
 * the paper's (judge.ts PAPER_JUDGE).
 */
export const LongMemEvalRunnerConfig = RunnerConfig.extend({
  benchmark: z.literal("longmemeval"),
})
  .refine(
    (c) => c.conditions.every((x) => (LONGMEMEVAL_CONDITIONS as readonly string[]).includes(x)),
    {
      message: "only C2 and C5 are built on LongMemEval (cards B5 and B6)",
      path: ["conditions"],
    },
  )
  .refine((c) => c.c4_verdicts === undefined, {
    message: "c4_verdicts is GateMem's; C4 is not built on LongMemEval",
    path: ["c4_verdicts"],
  });
export type LongMemEvalRunnerConfig = z.infer<typeof LongMemEvalRunnerConfig>;

/** Whether the JSON config at `path` names this benchmark. */
export function isLongMemEvalConfig(path: string): boolean {
  const raw = JSON.parse(readFileSync(path, "utf8")) as { benchmark?: unknown };
  return raw.benchmark === "longmemeval";
}

export function parseLongMemEvalConfig(
  value: unknown,
  base = process.cwd(),
): LongMemEvalRunnerConfig {
  return resolvePaths(checkConfig(LongMemEvalRunnerConfig.parse(value)), base);
}

/** Read a config file; its paths are resolved against the file's directory. */
export const readLongMemEvalConfig = (path: string): LongMemEvalRunnerConfig =>
  parseLongMemEvalConfig(JSON.parse(readFileSync(path, "utf8")), dirname(resolve(path)));

/** The judge a LongMemEval config runs: its own, the paper's for an experiment, else none. */
export function longMemEvalJudge(
  config: Pick<LongMemEvalRunnerConfig, "judge" | "kind">,
): { model: string; temperature: number; max_tokens: number; script?: string } | undefined {
  if (config.judge) return config.judge;
  if (config.kind !== "experiment") return undefined;
  const p = longMemEval.PAPER_JUDGE;
  return { model: p.model, temperature: p.temperature, max_tokens: p.maxTokens };
}

/** The cache context of a reader session; C2 states and enforces no policy, so its preset is `none`. */
export function longMemEvalContext(spec: {
  questionId: string;
  condition: Condition;
  preset: PresetName;
  store: StoreName;
}): CallContext {
  return {
    item: `longmemeval/${spec.questionId}`,
    condition: spec.condition,
    preset: statedPreset(spec.condition, spec.preset),
    store: spec.store,
  };
}

/** The cache context of the judge's call on one session's hypothesis. */
export const longMemEvalJudgeContext = (
  spec: Parameters<typeof longMemEvalContext>[0],
): CallContext => {
  const reader = longMemEvalContext(spec);
  return { ...reader, condition: `${reader.condition}:judge` };
};

export interface LongMemEvalProbeResult {
  item: string;
  question_id: string;
  /** The question's category (type, `+abstention`); for the breakdown, never shown to the model. */
  category: string;
  condition: Condition;
  store: StoreName;
  seed: number;
  /** Write decisions by `<decision>` (C5), or `ungoverned` (C2), with their counts. */
  writes: Record<string, number>;
  /** Items the store holds after the write phase. */
  stored: number;
  tool_calls: { name: string; arguments: unknown }[];
  /** What memory_read returned to the session, as the model's context holds it. */
  read: string[];
  /** The final reply. */
  hypothesis: string;
  /** The judge's verdict, or null when the config runs no judge. */
  judge: { reply: string; label: boolean } | null;
  decisions: SessionDecision[];
}

export interface LongMemEvalProbeSpec {
  question: longMemEval.Question;
  condition: Condition;
  seed: number;
  model: string;
  preset: PresetName;
  policy: Policy;
  store: StoreName;
  cache: CacheStore;
  answers: () => AnswerSource;
  /** The judge's call for this question, already cached; none means no judging. */
  judge?: { call: ModelCall; settings: longMemEval.JudgeSettings } | undefined;
  offline?: boolean;
  onUsage?: (usage: UsageRecord) => void;
  readLimit?: number;
}

const textOf = (content: unknown): string =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.flatMap((c) => (c && c.type === "text" ? [String(c.text)] : [])).join("")
      : "";

/** The write phase: through the plane under C5, straight to the store under C2. */
async function writeHistory(
  spec: LongMemEvalProbeSpec,
  view: longMemEval.VisibleQuestion,
  deps: { store: UngovernedStore; db: ReturnType<typeof openSqlite>; newId: () => string },
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (CONDITION_TABLE[spec.condition].memory === "plane") {
    const plane = createPlane({
      db: deps.db,
      adapter: deps.store.adapter,
      policy: spec.policy,
      newId: deps.newId,
    });
    for (const w of await longMemEval.writePhase(plane, view, deps.newId)) {
      if (w.result.item) deps.store.scopes.add(w.result.item.scope);
      const d = w.result.event.decision;
      counts[d] = (counts[d] ?? 0) + 1;
    }
    return counts;
  }
  for (const { item } of longMemEval.historyWrites(view, deps.newId)) {
    // Ungoverned ingestion: straight to the store, as C2 reads it.
    await deps.store.adapter.write(item);
    deps.store.scopes.add(item.scope);
    counts.ungoverned = (counts.ungoverned ?? 0) + 1;
  }
  return counts;
}

/** Run one question under one condition, store and seed; the store is closed after it. */
export async function runLongMemEvalProbe(
  spec: LongMemEvalProbeSpec,
): Promise<LongMemEvalProbeResult> {
  if (!(LONGMEMEVAL_CONDITIONS as readonly string[]).includes(spec.condition)) {
    throw new Error(`${spec.condition} is not built on LongMemEval (only C2 and C5)`);
  }
  const adapter = await openStore(spec.store);
  try {
    return await probeOn(spec, adapter);
  } finally {
    await closeStore(adapter);
  }
}

async function probeOn(
  spec: LongMemEvalProbeSpec,
  adapter: Adapter,
): Promise<LongMemEvalProbeResult> {
  const view = longMemEval.visibleQuestion(spec.question);
  const newId = sequentialIds();
  const store: UngovernedStore = { adapter, scopes: new Set() };
  const db = openSqlite(":memory:");
  migrate(db);
  const writes = await writeHistory(spec, view, { store, db, newId });
  const stored = (await Promise.all([...store.scopes].map((s) => store.adapter.list(s)))).reduce(
    (n, l) => n + l.length,
    0,
  );
  const context = {
    questionId: view.question_id,
    condition: spec.condition,
    preset: spec.preset,
    store: spec.store,
  };

  const cwd = mkdtempSync(join(tmpdir(), "engram-b5-"));
  const cassette = cassettePiModel({
    model: spec.model,
    seed: spec.seed,
    cwd,
    cache: spec.cache,
    context: longMemEvalContext(context),
    answers: spec.answers(),
    ...(spec.offline === undefined ? {} : { offline: spec.offline }),
    ...(spec.onUsage === undefined ? {} : { onUsage: spec.onUsage }),
  });
  const { system, user } = longMemEval.renderReaderPrompt(view, MEMORY_BLOCK);
  const { session, sessionManager } = await conditionSession({
    condition: spec.condition,
    cwd,
    model: cassette,
    systemPrompt: system,
    actor: longMemEval.userActor(),
    preset: spec.preset,
    policy: spec.policy,
    store,
    db,
    newId,
    now: () => longMemEval.readTime(view),
    ...(spec.readLimit === undefined ? {} : { readLimit: spec.readLimit }),
  });
  try {
    await session.prompt(user);
    if (cassette.errors.length > 0) throw cassette.errors[0];
    const messages = session.messages;
    const toolCalls = messages.flatMap((m) =>
      m.role === "assistant"
        ? m.content.flatMap((c) =>
            c.type === "toolCall" ? [{ name: c.name, arguments: c.arguments }] : [],
          )
        : [],
    );
    // C5's session keeps a placeholder for each read; the items the plane
    // admitted are in the result's details (as mem-inv-probe.ts reads them).
    const read = messages.flatMap((m) => {
      if (m.role !== "toolResult" || m.toolName !== "memory_read") return [];
      const details = m.details as Partial<RecallDetails> | undefined;
      return [
        Array.isArray(details?.items) && typeof details?.read_id === "string"
          ? renderRecall(details as RecallDetails)
          : textOf(m.content),
      ];
    });
    const final = [...messages].reverse().find((m) => m.role === "assistant");
    const hypothesis = final ? textOf(final.content) : "";
    const decisions = sessionManager.getEntries().flatMap((e) => {
      if (e.type !== "custom" || e.customType !== ENGRAM_EVENT) return [];
      const { op, decision, policy_id, reason } = e.data as SessionDecision;
      return [{ op, decision, policy_id, reason }];
    });
    const verdict = spec.judge
      ? await longMemEval.judgeAnswer(
          spec.judge.call,
          spec.question,
          hypothesis,
          spec.judge.settings,
        )
      : null;
    return {
      item: `longmemeval/${view.question_id}`,
      question_id: view.question_id,
      category: longMemEval.categoryOf(spec.question),
      condition: spec.condition,
      store: spec.store,
      seed: spec.seed,
      writes,
      stored,
      tool_calls: toolCalls,
      read,
      hypothesis,
      judge: verdict ? { reply: verdict.reply, label: verdict.label } : null,
      decisions,
    };
  } finally {
    session.dispose();
    db.close();
    rmSync(cwd, { recursive: true, force: true });
  }
}

export interface LongMemEvalRunnerResult {
  config: string;
  rows: LongMemEvalProbeResult[];
  /** Per condition (per `<condition>@<store>` when the config names several stores): the category breakdown of the judged rows. */
  summary: Record<
    string,
    { sessions: number; judged: number; breakdown: longMemEval.CategoryBreakdown }
  >;
  calls: { new: number; cached: number };
  usage: UsageRecord[];
}

export interface LongMemEvalRunnerOptions {
  cache?: CacheStore;
  offline?: boolean;
  live?: LiveModels;
}

/** The judge's uncached call for one question: the script's reply for a scripted judge; otherwise none here. */
function judgeInner(
  judge: NonNullable<ReturnType<typeof longMemEvalJudge>>,
  questionId: string,
): ModelCall {
  if (judge.model.startsWith("scripted/")) {
    const script = JSON.parse(
      readFileSync(judge.script as string, "utf8"),
    ) as longMemEval.JudgeScript;
    return longMemEval.scriptedJudge(script, questionId);
  }
  return async (request) => {
    throw new Error(
      `no live judge ${request.model} to answer a cache miss: the live LongMemEval baseline waits for the pre-registration`,
    );
  };
}

export async function runLongMemEvalConfig(
  config: LongMemEvalRunnerConfig,
  options: LongMemEvalRunnerOptions = {},
): Promise<LongMemEvalRunnerResult> {
  const questions = longMemEval.loadQuestions(config.data);
  const policy = loadPreset(config.preset);
  const cache = options.cache ?? fileCache(config.cassettes);
  const usage: UsageRecord[] = [];
  const rows: LongMemEvalProbeResult[] = [];
  const stores = configStores(config);
  const judge = longMemEvalJudge(config);
  const items = configItems(
    config,
    questions.map((q) => q.question_id),
  );
  for (const item of items) {
    const question = longMemEval.findQuestion(questions, item);
    for (const store of stores) {
      for (const condition of config.conditions) {
        for (const seed of config.seeds) {
          const judged = judge
            ? {
                call: cached(judgeInner(judge, item), {
                  cache,
                  context: longMemEvalJudgeContext({
                    questionId: item,
                    condition,
                    preset: config.preset,
                    store,
                  }),
                  ...(options.offline === undefined ? {} : { offline: options.offline }),
                  onUsage: (u) => usage.push(u),
                }),
                settings: {
                  model: judge.model,
                  seed,
                  temperature: judge.temperature,
                  maxTokens: judge.max_tokens,
                },
              }
            : undefined;
          rows.push(
            await runLongMemEvalProbe({
              question,
              condition,
              seed,
              model: config.model,
              preset: config.preset,
              policy,
              store,
              cache,
              answers: answersFor(config, item, condition, options.live),
              judge: judged,
              ...(config.read_limit === undefined ? {} : { readLimit: config.read_limit }),
              ...(options.offline === undefined ? {} : { offline: options.offline }),
              onUsage: (u) => usage.push(u),
            }),
          );
        }
      }
    }
  }
  const summary: LongMemEvalRunnerResult["summary"] = {};
  for (const store of stores) {
    for (const condition of config.conditions) {
      const mine = rows.filter((r) => r.condition === condition && r.store === store);
      const labelled = mine.flatMap((r) =>
        r.judge
          ? [{ question: longMemEval.findQuestion(questions, r.question_id), label: r.judge.label }]
          : [],
      );
      summary[stores.length === 1 ? condition : `${condition}@${store}`] = {
        sessions: mine.length,
        judged: labelled.length,
        breakdown: longMemEval.categoryBreakdown(labelled),
      };
    }
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
export function writeLongMemEvalResult(result: LongMemEvalRunnerResult, out: string): void {
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, "results.jsonl"),
    result.rows.map((r) => `${JSON.stringify(r)}\n`).join(""),
  );
  const { config, summary, calls, usage } = result;
  writeFileSync(join(out, "summary.json"), `${JSON.stringify({ config, summary }, null, 2)}\n`);
  writeFileSync(join(out, "usage.json"), `${JSON.stringify({ config, calls, usage }, null, 2)}\n`);
}
