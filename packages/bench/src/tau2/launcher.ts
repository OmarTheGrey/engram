// The tau2-bench launcher (card B11): one tau2 process per (condition, seed)
// of a config, every model call through card B10's cassette proxy and every
// memory call through the condition's memory, and tau2's own rewards read
// back from what it wrote.
//
// Per (condition, seed), in config order:
//   1. two proxies per task, the agent's and the user simulator's, each with
//      its whole cell fixed (harness tau2, item `<domain>/<task>/<role>`, the
//      condition, the key's preset and store, the seed), so the role is in
//      every key and in the ledger, and the scripted upstream knows its task;
//      each endpoint passes `checkHarnessEndpoint` before tau2 is given it;
//   2. the condition's memory: none (C1), the ungoverned store (C2,
//      memory.ts) or the plane (C5, `engram serve` on a scratch log and
//      files store, started by the caller);
//   3. tau2 at its pin in its own environment (scripts/tau2_engram.py), the
//      tasks in order, memory kept across them;
//   4. its SimulationRun files, read for the reward (the database hash check,
//      `db_check`), tau2's own reward, the steps and the termination.
//
// The ledger is the runner's (card RV1): one usage record per call, a hit at
// zero cost with the recorded usage in `cached`.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Actor, Adapter } from "@engram/core";
import {
  type CacheStore,
  type ChatCall,
  checkHarnessEndpoint,
  type ProxyError,
  type ProxyHandle,
  type RecordMode,
  startProxy,
  type UsageRecord,
} from "@engram/model";
import {
  keyPreset,
  keyStore,
  TAU2_HARNESS,
  TAU2_MEMORY,
  type Tau2Condition,
  type Tau2Config,
  taskItem,
} from "./config.ts";
import { startUngovernedMemory } from "./memory.ts";

/** The agent's memory owner: a person scope of its own, as model content stays in person scope (ADR 0004, 0007). */
export const AGENT_OWNER = "tau2-agent";

/** The actor every memory call is made as: the agent, its writes with source `model` (ADR 0004, D4). */
export const agentActor = (domain: string): Actor => ({
  id: `person:${AGENT_OWNER}`,
  level: "person",
  memberships: [`person:${AGENT_OWNER}`, `team:tau2-${domain}`],
  source: "model",
});

export type Role = "agent" | "user";

/** A running `engram serve`. */
export interface Served {
  url: string;
  close(): Promise<void>;
}

export interface Tau2Options {
  config: Tau2Config;
  out: string;
  repo: string;
  /** tau2's Python (env.ts). */
  python: string;
  /** packages/bench/scripts/tau2_engram.py. */
  driver: string;
  cache: CacheStore;
  record: RecordMode;
  recordFixtures?: boolean;
  /** Committed cassette folders a recording must not write (the config's own, when replaying). */
  committed?: readonly string[];
  /** The upstream that answers a miss while recording: the scripted one. */
  upstream?: (item: string, role: Role) => ChatCall;
  /** C2's store, in a scratch folder. */
  openStore: (dir: string) => Adapter;
  /** C5's plane: `engram serve` over a scratch log and files store at the preset. */
  startPlane: (dir: string, preset: string) => Promise<Served>;
  env: NodeJS.ProcessEnv;
  /** Each tau2 process is stopped after this long. */
  timeoutMs?: number;
}

export interface UsageRow extends UsageRecord {
  condition: Tau2Condition;
  seed: number;
  task: string;
  role: Role;
}

export interface TaskRow {
  condition: Tau2Condition;
  seed: number;
  task: string;
  preset: string;
  store: string;
  termination: string;
  /** The database hash check: 1 when the agent's database and the user's equal the gold run's. */
  reward: number;
  db_match: boolean;
  /** tau2's own reward for the evaluation it ran. */
  tau2_reward: number;
  evaluation: string;
  /** Messages in tau2's trajectory. */
  steps: number;
  memory_writes: number;
  memory_writes_denied: number;
  memory_reads: number;
}

export interface Tau2Result {
  rows: TaskRow[];
  usage: UsageRow[];
  errors: (ProxyError & { condition: string; seed: number; task: string; role: Role })[];
  /** Every memory call the shim made, as it logged it, with its condition and seed. */
  memory: (Record<string, unknown> & { condition: Tau2Condition; seed: number })[];
}

/** tau2 did not finish a (condition, seed): its log says why; a cassette miss is one cause. */
export class Tau2RunFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Tau2RunFailed";
  }
}

interface MemoryEntry {
  task: string;
  tool: string;
  decision: string;
}

const readJsonl = <T>(path: string): T[] =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as T);

function runPython(
  python: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  log: string,
  timeoutMs: number,
): Promise<number | null> {
  return new Promise((done, fail) => {
    const child = spawn(python, ["-I", ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.stderr.on("data", (c: Buffer) => chunks.push(c));
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      fail(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      writeFileSync(log, Buffer.concat(chunks));
      done(code);
    });
  });
}

interface SimulationRun {
  termination_reason: string;
  reward_info: { reward: number; db_check: { db_match: boolean; db_reward: number } | null } | null;
  messages: unknown[] | null;
}

/** Runs every (condition, seed) of the config; stops at the first that does not finish. */
export async function runTau2(options: Tau2Options): Promise<Tau2Result> {
  const { config } = options;
  const result: Tau2Result = { rows: [], usage: [], errors: [], memory: [] };
  const actor = agentActor(config.domain);
  for (const condition of config.conditions) {
    for (const seed of config.seeds) {
      const dir = join(options.out, "runs", `${condition}-s${seed}`);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      const preset = keyPreset(condition, config.preset);
      const store = keyStore(condition, config.store);
      const proxies: ProxyHandle[] = [];
      let memory: Served | undefined;
      try {
        const tasks = [];
        for (const task of config.tasks) {
          const handles = {} as Record<Role, ProxyHandle>;
          for (const role of ["agent", "user"] as const) {
            const item = taskItem(config.domain, task, role);
            const proxy = await startProxy({
              cache: options.cache,
              context: { harness: TAU2_HARNESS, item, condition, preset, store, seed },
              record: options.record,
              ...(options.upstream === undefined
                ? {}
                : { upstream: options.upstream(`${config.domain}/${task}`, role) }),
              repo: options.repo,
              ...(options.committed === undefined ? {} : { committed: options.committed }),
              ...(options.recordFixtures === true ? { recordFixtures: true } : {}),
              env: options.env,
              onUsage: (u) => result.usage.push({ ...u, condition, seed, task, role }),
              onError: (e) => result.errors.push({ ...e, condition, seed, task, role }),
            });
            proxies.push(proxy);
            checkHarnessEndpoint(proxy.baseUrl, { port: proxy.port });
            handles[role] = proxy;
          }
          tasks.push({
            id: task,
            agent_base_url: handles.agent.baseUrl,
            agent_item: taskItem(config.domain, task, "agent"),
            user_base_url: handles.user.baseUrl,
            user_item: taskItem(config.domain, task, "user"),
          });
        }
        const kind = TAU2_MEMORY[condition];
        if (kind === "store") {
          const ungoverned = await startUngovernedMemory({
            adapter: options.openStore(join(dir, "store")),
            at: config.memory_time,
            readLimit: config.read_limit,
          });
          memory = ungoverned;
        } else if (kind === "plane") {
          memory = await options.startPlane(dir, config.preset);
        }
        const job = {
          domain: config.domain,
          split: config.split,
          seed,
          temperature: config.temperature,
          max_steps: config.max_steps,
          max_errors: config.max_errors,
          // LiteLLM's provider prefix: the proxy sees the model without it (card B10's finding).
          agent_model: `openai/${config.agent_model}`,
          user_model: `openai/${config.user_model}`,
          tasks,
          memory:
            memory === undefined
              ? null
              : {
                  kind,
                  url: memory.url,
                  actor,
                  at: config.memory_time,
                  read_limit: config.read_limit,
                  run: `${config.name}/${condition}/${seed}`,
                },
          out: join(dir, "tau2"),
        };
        const jobPath = join(dir, "job.json");
        writeFileSync(jobPath, `${JSON.stringify(job, null, 2)}\n`);
        const code = await runPython(
          options.python,
          [options.driver, jobPath],
          {
            ...options.env,
            // LiteLLM fetches its price table from the network at import unless told not to.
            LITELLM_LOCAL_MODEL_COST_MAP: "True",
            PYTHONUTF8: "1",
            PYTHONIOENCODING: "utf-8",
          },
          join(dir, "tau2.log"),
          options.timeoutMs ?? 1_800_000,
        );
        const misses = result.errors.filter((e) => e.condition === condition && e.seed === seed);
        if (code !== 0) {
          const first = misses[0];
          throw new Tau2RunFailed(
            `tau2 stopped (exit ${code}) under ${condition}, seed ${seed}; log ${join(dir, "tau2.log")}${
              first ? `; first proxy error: ${first.status} ${first.code} on ${first.task} (${first.role}): ${first.message}` : ""
            }`,
          );
        }
        const entries = readJsonl<MemoryEntry>(join(dir, "tau2", "memory.jsonl"));
        for (const e of entries) result.memory.push({ ...e, condition, seed });
        for (const row of readJsonl<{ task: string; evaluation: string; simulation: string }>(
          join(dir, "tau2", "tasks.jsonl"),
        )) {
          const sim = JSON.parse(readFileSync(row.simulation, "utf8")) as SimulationRun;
          const db = sim.reward_info?.db_check ?? null;
          const own = entries.filter((e) => e.task === row.task);
          const writes = own.filter((e) => e.tool === "memory_write");
          result.rows.push({
            condition,
            seed,
            task: row.task,
            preset,
            store,
            termination: sim.termination_reason,
            reward: db?.db_reward ?? 0,
            db_match: db?.db_match ?? false,
            tau2_reward: sim.reward_info?.reward ?? 0,
            evaluation: row.evaluation,
            steps: sim.messages?.length ?? 0,
            memory_writes: writes.length,
            memory_writes_denied: writes.filter((e) => e.decision === "deny").length,
            memory_reads: own.filter((e) => e.tool === "memory_read").length,
          });
        }
      } finally {
        await Promise.all(proxies.map((p) => p.close()));
        await memory?.close();
      }
    }
  }
  return result;
}

/** One cassette entry's role, from its item. */
export const roleOf = (item: string): Role | undefined =>
  item.endsWith("/agent") ? "agent" : item.endsWith("/user") ? "user" : undefined;
