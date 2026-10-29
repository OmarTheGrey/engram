// One MEM-INV-Bench case as a pi SDK session (card B4, ADR 0029), the way
// RN1 runs a GateMem checkpoint (gatemem-probe.ts). The case's memory is
// written first: under C5 every entry crosses Plane.write as its channel's
// actor with the provenance kind the channel implies (packages/bench
// mem-inv-bench/plane.ts); under C2 and C3 the same items go straight to the
// store, which is what those conditions measure. Then the user's request is
// the session's prompt, the model reads its memory with memory_read (under C5
// the action-time Plane.read), and its final reply is the proposed action,
// scored with the benchmark's rule bucketer. The model and the plane see only
// the visible case; the scorer alone reads the labels.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createFakeAdapter } from "@engram/adapters";
import { memInvBench } from "@engram/bench";
import {
  type Adapter,
  createPlane,
  loadPreset,
  type MemoryEvent,
  migrate,
  openSqlite,
  type Policy,
  type PresetName,
} from "@engram/core";
import { ENGRAM_EVENT, type RecallDetails, renderRecall } from "@engram/pi-extension";
import { z } from "zod";
import { conditionSession, type UngovernedStore } from "./conditions.ts";
import { type Condition, RunnerConfig } from "./config.ts";
import { MEMORY_BLOCK, readProbeScript, sequentialIds } from "./gatemem-probe.ts";
import { type CacheStore, type CallContext, fileCache, type UsageRecord } from "./model/cached.ts";
import { type AnswerSource, cassettePiModel, scriptedAnswers } from "./model/cassette.ts";

/** A runner config for MEM-INV-Bench: RN1's fields, with this benchmark and its fixture directory as `data`. */
// One store, the fake, for now: card B3's multi-store configs are a GateMem runner feature,
// and running this probe on mem0 or letta is left to the card that needs it.
export const MemInvRunnerConfig = RunnerConfig.extend({
  benchmark: z.literal("mem-inv-bench"),
  store: z.literal("fake"),
});
export type MemInvRunnerConfig = z.infer<typeof MemInvRunnerConfig>;

/** Whether the JSON config at `path` names this benchmark. */
export function isMemInvConfig(path: string): boolean {
  const raw = JSON.parse(readFileSync(path, "utf8")) as { benchmark?: unknown };
  return raw.benchmark === "mem-inv-bench";
}

export function parseMemInvConfig(value: unknown, base = process.cwd()): MemInvRunnerConfig {
  const config = MemInvRunnerConfig.parse(value);
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
export const readMemInvConfig = (path: string): MemInvRunnerConfig =>
  parseMemInvConfig(JSON.parse(readFileSync(path, "utf8")), dirname(resolve(path)));

/** A write-phase decision, as the results record it. */
export interface EntryDecision {
  entry_id: string;
  channel: memInvBench.OriginChannel;
  /** The provenance kind and actor the item was written with, and where it was meant to land. */
  kind: string;
  actor: string;
  scope: string;
  /** The plane's decision under C5; `ungoverned` under C2 and C3, which write past the plane. */
  decision: string;
  policy_id: string | null;
  reason: string | null;
}

/** A policy decision of the session, from its engram.event entries (C5 only). */
export interface SessionDecision {
  op: string;
  decision: string;
  policy_id: string;
  reason: string;
}

export interface MemInvProbeResult {
  item: string;
  case_id: string;
  condition: Condition;
  seed: number;
  writes: EntryDecision[];
  /** Items the store holds after the write phase. */
  stored: number;
  tool_calls: { name: string; arguments: unknown }[];
  /** What memory_read returned to the session, as the model's context holds it. */
  read: string[];
  /** The final reply: the proposed action. */
  proposal: string;
  outcome: memInvBench.Outcome;
  decisions: SessionDecision[];
}

export interface MemInvProbeSpec {
  case: memInvBench.Case;
  condition: Condition;
  seed: number;
  model: string;
  preset: PresetName;
  policy: Policy;
  store: "fake";
  cache: CacheStore;
  answers: () => AnswerSource;
  offline?: boolean;
  onUsage?: (usage: UsageRecord) => void;
}

/** The cache context of a probe; C2 states and enforces no policy, so its preset is `none`. */
export function memInvContext(
  spec: Pick<MemInvProbeSpec, "condition" | "preset" | "store"> & { caseId: string },
): CallContext {
  return {
    item: `mem-inv-bench/${spec.caseId}`,
    condition: spec.condition,
    preset: spec.condition === "C2" ? "none" : spec.preset,
    store: spec.store,
  };
}

const textOf = (content: unknown): string =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.flatMap((c) => (c && c.type === "text" ? [String(c.text)] : [])).join("")
      : "";

const decisionOf = (e: MemoryEvent) => ({
  decision: e.decision,
  policy_id: e.policy_id,
  reason: e.reason,
});

/**
 * How the final reply ended, in upstream's cell terms (review.cells: p_finish,
 * p_trunc, p_ok), so the scorer excludes what upstream excludes (review finding
 * R6-5): pi's `length` is a truncated reply, `error` and `aborted` a failed
 * call, and an error whose message names a content filter is upstream's
 * `content_filter`. pi-ai has no content-filter stop reason of its own, and
 * the cassette model throws on `error` and `aborted` before a reply is
 * recorded, so in this runner only `length` reaches the scorer today.
 */
export function replyEnding(message: { stopReason: string; errorMessage?: string | undefined }): {
  finish: string;
  truncated: boolean;
  ok: boolean;
} {
  const failed = message.stopReason === "error" || message.stopReason === "aborted";
  const filtered = failed && /content[ _-]?filter/i.test(message.errorMessage ?? "");
  return {
    finish: filtered ? "content_filter" : message.stopReason,
    truncated: message.stopReason === "length",
    ok: !failed,
  };
}

/** The write phase: through the plane under C5, straight to the store otherwise. */
async function writeMemory(
  spec: MemInvProbeSpec,
  view: memInvBench.VisibleCase,
  deps: { store: UngovernedStore; db: ReturnType<typeof openSqlite>; newId: () => string },
): Promise<EntryDecision[]> {
  const describe = (entry: memInvBench.MemoryEntry) => {
    const w = memInvBench.CHANNEL_WRITERS[entry.channel];
    return {
      entry_id: entry.entry_id,
      channel: entry.channel,
      kind: memInvBench.entryKind(entry),
      actor: w.actor,
      scope: w.scope,
    };
  };
  if (spec.condition === "C5") {
    const plane = createPlane({
      db: deps.db,
      adapter: deps.store.adapter,
      policy: spec.policy,
      newId: deps.newId,
    });
    const writes = await memInvBench.writePhase(plane, view, deps.newId);
    for (const w of writes) if (w.result.item) deps.store.scopes.add(w.result.item.scope);
    return writes.map((w, i) => ({
      ...describe(view.memory[i] as memInvBench.MemoryEntry),
      ...decisionOf(w.result.event),
    }));
  }
  const times = memInvBench.phaseTimes(view);
  const out: EntryDecision[] = [];
  for (const [i, entry] of view.memory.entries()) {
    const item = memInvBench.entryItem(entry, deps.newId(), times.entry(i));
    // Ungoverned ingestion: straight to the store, as C2 and C3 read it.
    await deps.store.adapter.write(item);
    deps.store.scopes.add(item.scope);
    out.push({ ...describe(entry), decision: "ungoverned", policy_id: null, reason: null });
  }
  return out;
}

/** Run one case under one condition and seed. */
export async function runMemInvProbe(spec: MemInvProbeSpec): Promise<MemInvProbeResult> {
  const view = memInvBench.visibleCase(spec.case);
  const newId = sequentialIds();
  const adapter: Adapter = createFakeAdapter();
  const store: UngovernedStore = { adapter, scopes: new Set() };
  const db = openSqlite(":memory:");
  migrate(db);
  const writes = await writeMemory(spec, view, { store, db, newId });
  const stored = (await Promise.all([...store.scopes].map((s) => store.adapter.list(s)))).reduce(
    (n, l) => n + l.length,
    0,
  );

  const cwd = mkdtempSync(join(tmpdir(), "engram-b4-"));
  const cassette = cassettePiModel({
    model: spec.model,
    seed: spec.seed,
    cwd,
    cache: spec.cache,
    context: memInvContext({ ...spec, caseId: view.case_id }),
    answers: spec.answers(),
    ...(spec.offline === undefined ? {} : { offline: spec.offline }),
    ...(spec.onUsage === undefined ? {} : { onUsage: spec.onUsage }),
  });
  const { system, user } = memInvBench.renderProposalPrompt(view, MEMORY_BLOCK);
  const { session, sessionManager } = await conditionSession({
    condition: spec.condition,
    cwd,
    model: cassette,
    systemPrompt: system,
    actor: memInvBench.operatorActor(),
    preset: spec.preset,
    policy: spec.policy,
    store,
    db,
    newId,
    now: () => memInvBench.phaseTimes(view).action,
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
    // admitted are in the result's details (as gatemem-probe.ts reads them).
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
    const proposal = final ? textOf(final.content) : "";
    const ending = final ? replyEnding(final) : { finish: "stop", truncated: false, ok: true };
    const decisions = sessionManager.getEntries().flatMap((e) => {
      if (e.type !== "custom" || e.customType !== ENGRAM_EVENT) return [];
      const { op, decision, policy_id, reason } = e.data as SessionDecision;
      return [{ op, decision, policy_id, reason }];
    });
    return {
      item: `mem-inv-bench/${view.case_id}`,
      case_id: view.case_id,
      condition: spec.condition,
      seed: spec.seed,
      writes,
      stored,
      tool_calls: toolCalls,
      read,
      proposal,
      outcome: memInvBench.scoreProposal(spec.case, proposal, ending),
      decisions,
    };
  } finally {
    session.dispose();
    db.close();
    rmSync(cwd, { recursive: true, force: true });
  }
}

export interface MemInvRunnerResult {
  config: string;
  rows: MemInvProbeResult[];
  /** Per condition, how many sessions got each verdict, and how many attacks succeeded. */
  summary: Record<
    string,
    { sessions: number; attack_success: number; verdicts: Record<string, number> }
  >;
  calls: { new: number; cached: number };
  usage: UsageRecord[];
}

/** The scripted model's steps for a case; a non-scripted model has no live source here. */
function answersFor(config: MemInvRunnerConfig, item: string): () => AnswerSource {
  const [provider = "", ...rest] = config.model.split("/");
  if (provider !== "scripted")
    return () => async () => {
      throw new Error(`no live model ${config.model} to answer a cache miss`);
    };
  const steps = readProbeScript(config.script as string).steps[item];
  return () =>
    steps
      ? scriptedAnswers(steps, { provider, model: rest.join("/") })
      : async () => {
          throw new Error(`the script has no steps for ${item}`);
        };
}

export async function runMemInvConfig(
  config: MemInvRunnerConfig,
  options: { cache?: CacheStore; offline?: boolean } = {},
): Promise<MemInvRunnerResult> {
  const cases = memInvBench.loadCases(config.data);
  const policy = loadPreset(config.preset);
  const cache = options.cache ?? fileCache(config.cassettes);
  const usage: UsageRecord[] = [];
  const rows: MemInvProbeResult[] = [];
  for (const item of config.items) {
    const c = memInvBench.findCase(cases, item);
    for (const condition of config.conditions) {
      for (const seed of config.seeds) {
        rows.push(
          await runMemInvProbe({
            case: c,
            condition,
            seed,
            model: config.model,
            preset: config.preset,
            policy,
            store: config.store,
            cache,
            answers: answersFor(config, item),
            ...(options.offline === undefined ? {} : { offline: options.offline }),
            onUsage: (u) => usage.push(u),
          }),
        );
      }
    }
  }
  const summary: MemInvRunnerResult["summary"] = {};
  for (const condition of config.conditions) {
    const mine = rows.filter((r) => r.condition === condition);
    const verdicts: Record<string, number> = {};
    for (const r of mine) verdicts[r.outcome.verdict] = (verdicts[r.outcome.verdict] ?? 0) + 1;
    summary[condition] = {
      sessions: mine.length,
      attack_success: mine.filter((r) => r.outcome.attack_success).length,
      verdicts,
    };
  }
  return {
    config: config.name,
    rows,
    summary,
    calls: { new: usage.filter((u) => !u.hit).length, cached: usage.filter((u) => u.hit).length },
    usage,
  };
}

/**
 * results.jsonl and summary.json, the same whether a run recorded its calls or
 * replayed them; usage.json, the call counts and the cost ledger (finding R7-10).
 */
export function writeMemInvResult(result: MemInvRunnerResult, out: string): void {
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, "results.jsonl"),
    result.rows.map((r) => `${JSON.stringify(r)}\n`).join(""),
  );
  const { config, summary, calls, usage } = result;
  writeFileSync(join(out, "summary.json"), `${JSON.stringify({ config, summary }, null, 2)}\n`);
  writeFileSync(join(out, "usage.json"), `${JSON.stringify({ config, calls, usage }, null, 2)}\n`);
}
