// The tau2-bench launcher (card B11): one tau2 process per (condition, seed)
// of a config, every model call through card B10's cassette proxy and every
// memory call through the condition's memory, and tau2's own rewards read
// back from what it wrote.
//
// Per (condition, seed), in config order:
//   1. three proxies per task, the agent's, the user simulator's and the NL
//      judge's, each with its whole cell fixed (harness tau2, item
//      `<domain>/<task>/<role>`, the condition, the key's preset and store,
//      the seed), so the role is in every key and in the ledger, and the
//      scripted upstream knows its task; each endpoint passes
//      `checkHarnessEndpoint` before tau2 is given it. The judge's is called
//      only by a task whose reward basis has NL assertions (retail);
//   2. the condition's memory: none (C1), the ungoverned store (C2,
//      memory.ts) or the plane (C5, plane.ts: `engram serve`'s app in
//      process, the runner's C5), each over a fresh files store;
//   3. tau2 at its pin in its own environment (scripts/tau2_engram.py), the
//      tasks in order, memory kept across them, in an environment with no
//      provider key (result.ts, tau2Env);
//   4. its SimulationRun files, read for tau2's reward, the database hash
//      check, the steps and the termination (result.ts, taskRow).
//
// The ledger is the runner's (card RV1): one usage record per call, a hit at
// zero cost with the recorded usage in `cached`.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
import { startPlaneMemory } from "./plane.ts";
import {
  type DriverRow,
  type MemoryEntry,
  PYTHON_FLAGS,
  type SimulationRun,
  type TaskRow,
  taskRow,
  tau2Env,
} from "./result.ts";

/** The agent's memory owner: a person scope of its own, as model content stays in person scope (ADR 0004, 0007). */
export const AGENT_OWNER = "tau2-agent";

/** The actor every memory call is made as: the agent, its writes with source `model` (ADR 0004, D4). */
export const agentActor = (domain: string): Actor => ({
  id: `person:${AGENT_OWNER}`,
  level: "person",
  memberships: [`person:${AGENT_OWNER}`, `team:tau2-${domain}`],
  source: "model",
});

export const ROLES = ["agent", "user", "judge"] as const;
export type Role = (typeof ROLES)[number];

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
  /** The upstream that answers a miss while recording: the scripted one, branded by asScripted. */
  upstream?: (item: string, role: Role) => ChatCall;
  /** A fresh store in a scratch folder, for C2 and C5. */
  openStore: (dir: string) => Adapter;
  /** The environment tau2 is started from; tau2Env strips it. */
  env: NodeJS.ProcessEnv;
}

export interface UsageRow extends UsageRecord {
  condition: Tau2Condition;
  seed: number;
  task: string;
  role: Role;
}

export interface Tau2Result {
  rows: TaskRow[];
  usage: UsageRow[];
  errors: (ProxyError & { condition: string; seed: number; task: string; role: Role })[];
  /** Every memory call the shim made, as it logged it, with its condition and seed. */
  memory: (MemoryEntry & Record<string, unknown> & { condition: Tau2Condition; seed: number })[];
  /** A (condition, seed) whose tau2 process did not exit cleanly, with its log. */
  failures: { condition: Tau2Condition; seed: number; code: number | null; log: string }[];
}

const readJsonl = <T>(path: string): T[] =>
  existsSync(path)
    ? readFileSync(path, "utf8")
        .split("\n")
        .filter((l) => l.trim() !== "")
        .map((l) => JSON.parse(l) as T)
    : [];

function runPython(
  python: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  log: string,
  timeoutMs: number,
): Promise<number | null> {
  return new Promise((done, fail) => {
    const child = spawn(python, [...PYTHON_FLAGS, ...args], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
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

/** Runs every (condition, seed) of the config; a task that fails is a row with its error. */
export async function runTau2(options: Tau2Options): Promise<Tau2Result> {
  const { config } = options;
  const result: Tau2Result = { rows: [], usage: [], errors: [], memory: [], failures: [] };
  const actor = agentActor(config.domain);
  for (const condition of config.conditions) {
    for (const seed of config.seeds) {
      const dir = join(options.out, "runs", `${condition}-s${seed}`);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      const preset = keyPreset(condition, config.preset);
      const store = keyStore(condition, config.store);
      const proxies: ProxyHandle[] = [];
      let memory: { url: string; close(): Promise<void> } | undefined;
      try {
        const tasks = [];
        for (const task of config.tasks) {
          const handles = {} as Record<Role, ProxyHandle>;
          for (const role of ROLES) {
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
            judge_base_url: handles.judge.baseUrl,
          });
        }
        const kind = TAU2_MEMORY[condition];
        if (kind === "store") {
          memory = await startUngovernedMemory({
            adapter: options.openStore(join(dir, "store")),
            at: config.memory_time,
            readLimit: config.read_limit,
          });
        } else if (kind === "plane") {
          memory = await startPlaneMemory({
            adapter: options.openStore(join(dir, "store")),
            preset: config.preset,
            at: config.memory_time,
            readLimit: config.read_limit,
          });
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
        const log = join(dir, "tau2.log");
        const code = await runPython(
          options.python,
          [options.driver, jobPath],
          tau2Env(options.env),
          log,
          config.timeout_s * 1000,
        );
        if (code !== 0) result.failures.push({ condition, seed, code, log });
        const entries = readJsonl<MemoryEntry & Record<string, unknown>>(
          join(dir, "tau2", "memory.jsonl"),
        );
        for (const e of entries) result.memory.push({ ...e, condition, seed });
        const cell = { condition, seed, preset, store };
        for (const row of readJsonl<DriverRow>(join(dir, "tau2", "tasks.jsonl"))) {
          const sim =
            row.simulation === null
              ? null
              : (JSON.parse(readFileSync(row.simulation, "utf8")) as SimulationRun);
          result.rows.push(taskRow(cell, row, sim, entries));
        }
      } finally {
        await Promise.all(proxies.map((p) => p.close()));
        await memory?.close();
      }
    }
  }
  return result;
}
