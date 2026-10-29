// `engram doctor`: one line per check, each with its reason. It never
// creates, migrates or otherwise changes a log (SQLite is opened read-only,
// Postgres sees SELECTs only), never prints a provider key's value (only its
// length is tested), and reaches no network beyond the Postgres server a
// postgres:// target names. A target's URL is printed only from the parts a
// strict parse accepted (scheme, hosts, ports, database name, four allowed
// query values); the userinfo, other query values and the fragment become
// `***`, a URL that does not parse prints as `postgres://<hidden: unparseable>`,
// and error messages are scrubbed of every secret (packages/cli/src/setup.ts).
// The adapter checks run through a Plane on an in-memory log, so
// no adapter is called directly (AGENTS.md rule 2) and nothing is recorded.
//
// The checks that read the repository (provider key names, benchmark pins,
// the pi pin) run only from a checkout (`io.repo`); elsewhere they are
// skipped with that reason. The provider key names come from
// packages/runner/src/model/provider-keys.json, which `make api` generates
// from pi-ai: the CLI never imports pi-ai (AGENTS.md, what not to do).
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { access, constants, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createFilesAdapter, createHashingEmbedder, createMem0Adapter } from "@engram/adapters";
import {
  type Actor,
  type Adapter,
  adoptStoreItems,
  createPlane,
  loadPreset,
  type MemoryItem,
  migrate,
  openSqlite,
  type PlaneDeps,
} from "@engram/core";
import { parse, STORE_OPTIONS } from "./commands.ts";
import { plural } from "./format.ts";
import type { Io } from "./run.ts";
import {
  type DbTarget,
  dbTarget,
  inspectLog,
  type LogState,
  loadPolicy,
  logRefusal,
  MEMORY_DB,
} from "./setup.ts";

export type Status = "ok" | "fail" | "skip";
export type CheckResult = [Status, string];
export interface Check {
  status: Status;
  name: string;
  detail: string;
}

/** The oldest Node the plane runs on: node:sqlite unflagged and type stripping (ADR 0019). */
export const MIN_NODE_MAJOR = 24;
/** Repository paths the checks read, relative to the checkout. */
export const PROVIDER_KEYS = "packages/runner/src/model/provider-keys.json";
export const PINS = "packages/bench/PINS.md";
export const DEPS = "docs/deps.md";
export const BENCH_FIXTURES = "fixtures/bench";

const NO_REPO: CheckResult = ["skip", "not run from a repository checkout"];
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
const oneLine = (e: unknown) => (e as Error).message.split("\n").join("; ");

/**
 * The log: found and named by backend, never created, never migrated
 * (inspectLog opens SQLite read-only and sends Postgres SELECTs only).
 * Pending migrations are reported for the next read or write to apply.
 */
export function checkLog(target: DbTarget): CheckResult {
  const name = `${target.backend} ${target.label}`;
  let state: LogState;
  try {
    state = inspectLog(target);
  } catch (e) {
    // The message already starts with the target's label.
    return ["fail", `${target.backend} ${(e as Error).message.split("\n").join("; ")}`];
  }
  if (state.state === "absent") {
    const reached = target.backend === "postgres" ? "connects, " : "";
    return ["ok", `${name}: ${reached}no log yet; the first read or write creates it`];
  }
  const refusal = logRefusal(target, state);
  if (refusal !== undefined) return ["fail", `${target.backend} ${refusal}`];
  const n = state.state === "engram" ? state.pending.length : 0;
  if (n > 0)
    return [
      "ok",
      `${name}: ${plural(n, "migration")} pending; the next read or write applies ${n === 1 ? "it" : "them"}`,
    ];
  return ["ok", `${name}: opens; up to date`];
}

/** Runs `fn` on a Plane over `adapter` with a fresh in-memory log and the medium preset. */
async function onScratchPlane<T>(
  adapter: Adapter,
  newId: () => string,
  fn: (deps: PlaneDeps) => Promise<T>,
): Promise<T> {
  const db = openSqlite(MEMORY_DB);
  try {
    migrate(db);
    return await fn({ db, adapter, policy: loadPreset("medium"), newId });
  } finally {
    db.close();
  }
}

/** The files adapter opens the root and lists its memories through the plane, as `engram read` adopts them. */
export async function checkFilesAdapter(
  root: string | undefined,
  at: string,
  newId: () => string,
): Promise<CheckResult> {
  if (root === undefined) return ["skip", "no --root given"];
  // The adapter lists a missing folder as empty; for doctor that is a failure.
  if (!existsSync(root)) return ["fail", `${root} does not exist`];
  const owner = "doctor";
  const adapter = createFilesAdapter({ root, owner });
  const report = await onScratchPlane(adapter, newId, (deps) =>
    adoptStoreItems(
      deps,
      { id: `person:${owner}`, level: "person", memberships: [`person:${owner}`] },
      `person:${owner}`,
      at,
    ),
  );
  const counts =
    `${plural(report.listed, "memory", "memories")} listed through the plane, ` +
    `${report.allowed} admitted, ${report.denied} denied (medium preset, in-memory log)`;
  // Files the adapter could not read are skipped by list; counted here, never shown.
  const unreadable = adapter.diagnostics().length;
  if (unreadable > 0)
    return [
      "fail",
      `${root}: ${plural(unreadable, "file")} unreadable by the files adapter; ${counts}`,
    ];
  return ["ok", `${root}: ${counts}`];
}

/** Opens an in-memory Mem0 with the hashing embedder: offline, no model, no key. */
export const openOfflineMem0 = () =>
  createMem0Adapter({ embedder: createHashingEmbedder(), dbPath: ":memory:" });

/** One write and one read through the plane on an offline Mem0. */
export async function checkMem0Adapter(
  at: string,
  newId: () => string,
  open: () => Promise<Adapter> = openOfflineMem0,
): Promise<CheckResult> {
  const adapter = await open();
  const actor: Actor = {
    id: "person:doctor",
    level: "person",
    memberships: ["person:doctor"],
    source: "user",
  };
  const content = "engram doctor probe";
  const item = {
    id: newId(),
    class: "semantic",
    scope: actor.id,
    owner: actor.id,
    content,
    provenance: {
      kind: "user",
      ref: "engram-doctor",
      hash: `sha256:${sha256(content)}`,
      actor: actor.id,
    },
    confidence: 0.9,
    valid_from: at,
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 0,
  } as unknown as MemoryItem;
  return onScratchPlane(adapter, newId, async (deps) => {
    const plane = createPlane(deps);
    const { event } = await plane.write(actor, item, at);
    if (event.decision !== "allow")
      return ["fail", `the probe write was not allowed: ${event.reason} (${event.policy_id})`];
    const read = await plane.read(actor, { text: content, at });
    if (!read.items.some((i) => i.id === item.id))
      return ["fail", "the probe item was written but a read did not return it"];
    return [
      "ok",
      "in-memory Mem0 with the hashing embedder: a write and a read round-trip through the plane, offline",
    ];
  });
}

const ProviderKeysError = (why: string) => new Error(`${PROVIDER_KEYS}: ${why}; run make api`);

/**
 * Providers whose credentials pi-ai also takes from somewhere other than a key
 * variable, beyond those with no key variable at all: Google Vertex accepts
 * Application Default Credentials besides GOOGLE_CLOUD_API_KEY.
 */
const AMBIENT_TOO = ["google-vertex (ADC)"];

/**
 * The provider key variable names pi-ai reads, by name with their providers,
 * and the providers that have none (ambient or login credentials only), as
 * the runner generated them.
 */
export function providerKeyNames(repo: string): {
  byName: Map<string, string[]>;
  keyless: string[];
} {
  const file = join(repo, PROVIDER_KEYS);
  if (!existsSync(file)) throw ProviderKeysError("missing");
  const data = readJson(file) as { providers?: unknown };
  const providers = data.providers;
  if (typeof providers !== "object" || providers === null || Array.isArray(providers))
    throw ProviderKeysError("has no providers object");
  const byName = new Map<string, string[]>();
  const keyless: string[] = [];
  for (const [provider, names] of Object.entries(providers)) {
    if (!Array.isArray(names) || names.some((n) => typeof n !== "string"))
      throw ProviderKeysError(`provider ${provider} has no list of names`);
    if (names.length === 0) keyless.push(provider);
    for (const name of names as string[]) byName.set(name, [...(byName.get(name) ?? []), provider]);
  }
  if (byName.size === 0) throw ProviderKeysError("names no key variable");
  return { byName, keyless };
}

/**
 * Which provider key variables are set. A variable counts only when its value
 * is non-empty, as pi-ai counts it; the check reads the value's length in
 * place and never copies, logs or prints the value. None set is not a
 * failure: scripted and cassette runs need no key. Credentials that are not
 * a key variable (AWS profiles, Google ADC, OAuth logins) are named as not
 * checked.
 */
export function checkProviderKeys(
  repo: string | undefined,
  env: Readonly<Record<string, string | undefined>>,
): CheckResult {
  if (repo === undefined) return NO_REPO;
  const { byName, keyless } = providerKeyNames(repo);
  const providers = new Set([...byName.values()].flat());
  const set = [...byName.keys()].filter((name) => (env[name]?.length ?? 0) > 0).sort();
  const notChecked = `not checked: ${[...keyless, ...AMBIENT_TOO].sort().join(", ")} (credentials that are not a key variable)`;
  if (set.length === 0)
    return [
      "ok",
      `none of ${byName.size} key variables for ${providers.size} providers is set; ` +
        `live model calls need one, scripted and cassette runs do not; ${notChecked}`,
    ];
  const named = set.map((name) => `${name} (${byName.get(name)?.join(", ")})`);
  return ["ok", `set: ${named.join("; ")}; values not read; ${notChecked}`];
}

interface PinRow {
  benchmark: string;
  commit: string | undefined;
  status: string;
}

/**
 * The registered pins table of packages/bench/PINS.md: the first table, before
 * "## Notes per pin"; a later table (candidates checked, not registered) is
 * not a pin. Throws on a row it cannot read.
 */
export function parsePins(text: string): PinRow[] {
  const all = text.split(/\r?\n/);
  const notes = all.findIndex((l) => /^##\s+Notes per pin/.test(l));
  const head = notes < 0 ? all : all.slice(0, notes);
  const start = head.findIndex((l) => l.trim().startsWith("|"));
  const end = start < 0 ? -1 : head.findIndex((l, i) => i > start && !l.trim().startsWith("|"));
  const lines = start < 0 ? [] : head.slice(start, end < 0 ? head.length : end);
  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
  const header = lines[0] ? cells(lines[0]) : [];
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`${PINS}: the table has no "${name}" column`);
    return i;
  };
  const [bi, ci, si] = [col("benchmark"), col("pinned commit"), col("status")];
  const rows: PinRow[] = [];
  for (const line of lines.slice(1)) {
    if (/^\|\s*-/.test(line.trim())) continue;
    const row = cells(line);
    if (row.length !== header.length)
      throw new Error(`${PINS}: a row has ${row.length} cells, the header ${header.length}`);
    const benchmark = row[bi] as string;
    const commit = /`([0-9a-f]{40})`/.exec(row[ci] as string)?.[1];
    const status = row[si] as string;
    if (status.startsWith("released") && commit === undefined)
      throw new Error(`${PINS}: ${benchmark} is released but has no 40-hex pinned commit`);
    rows.push({ benchmark, commit, status });
  }
  if (rows.length === 0) throw new Error(`${PINS}: no pins table`);
  return rows;
}

interface Manifest {
  source?: { commit?: string };
  selection?: {
    domain: string;
    episode_line_sha256: string;
    checkpoints: { line_sha256: string }[];
  }[];
}

/**
 * The sha256 of every line, blank lines included, as the vendoring wrote
 * them: lines joined by "\n" with one final "\n", so only that last empty
 * piece is dropped. An inserted blank line is a line and fails the match.
 */
const lineHashes = (path: string) => {
  const lines = readFileSync(path, "utf8").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map((l) => sha256(l));
};

/**
 * PINS.md parses, and every vendored benchmark fixture (fixtures/bench/<name>
 * with a manifest.json) was taken at its benchmark's pinned commit and still
 * holds exactly the lines its manifest hashes.
 */
export function checkBenchmarkPins(repo: string | undefined): CheckResult {
  if (repo === undefined) return NO_REPO;
  const pinsFile = join(repo, PINS);
  if (!existsSync(pinsFile)) return ["fail", `${PINS} is missing`];
  const rows = parsePins(readFileSync(pinsFile, "utf8"));
  const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const fixturesDir = join(repo, BENCH_FIXTURES);
  const fixtures = existsSync(fixturesDir)
    ? readdirSync(fixturesDir).filter((d) => statSync(join(fixturesDir, d)).isDirectory())
    : [];
  // Every vendored fixture carries its manifest; one without is unverifiable.
  const bare = fixtures.find((d) => !existsSync(join(fixturesDir, d, "manifest.json")));
  if (bare !== undefined) return ["fail", `fixtures/bench/${bare} has no manifest.json`];
  const checked: string[] = [];
  for (const dir of fixtures) {
    const manifest = readJson(join(fixturesDir, dir, "manifest.json")) as Manifest;
    const pin = rows.find((r) => key(r.benchmark) === key(dir));
    if (pin?.commit === undefined)
      return ["fail", `fixtures/bench/${dir} has a manifest but ${PINS} pins no commit for it`];
    if (manifest.source?.commit !== pin.commit)
      return [
        "fail",
        `fixtures/bench/${dir} was vendored at ${manifest.source?.commit}, ${PINS} pins ${pin.commit}`,
      ];
    if (!manifest.selection)
      return ["fail", `fixtures/bench/${dir}/manifest.json has no selection`];
    let lines = 0;
    for (const s of manifest.selection) {
      const files: [string, string[]][] = [
        ["episodes.jsonl", [s.episode_line_sha256]],
        ["checkpoints.jsonl", s.checkpoints.map((c) => c.line_sha256)],
      ];
      for (const [name, expected] of files) {
        const path = join(fixturesDir, dir, s.domain, name);
        const rel = `fixtures/bench/${dir}/${s.domain}/${name}`;
        if (!existsSync(path)) return ["fail", `${rel} is missing`];
        if (lineHashes(path).join() !== expected.join())
          return ["fail", `${rel} does not match the hashes in its manifest`];
        lines += expected.length;
      }
    }
    checked.push(`${dir} ${lines} lines at ${pin.commit.slice(0, 7)}`);
  }
  const pinned = rows.filter((r) => r.commit !== undefined).length;
  return [
    "ok",
    `${PINS}: ${rows.length} benchmarks, ${pinned} pinned; fixtures match their manifests: ${
      checked.join(", ") || "none vendored"
    }`,
  ];
}

const PI = /^@earendil-works\/pi-/;

/** The pi versions docs/deps.md records, by package name. */
export function depsPiPins(text: string): Map<string, string> {
  const pins = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^\|\s*(@earendil-works\/pi-[\w-]+)\s*\|\s*([^|\s]+)\s*\|/.exec(line);
    if (m?.[1] && m[2]) pins.set(m[1], m[2]);
  }
  return pins;
}

/**
 * Every pi package a workspace package depends on is pinned to the version
 * docs/deps.md records, and the installed copy is that version: a different
 * pi changes the interception points the extension relies on (S0.5).
 */
export function checkPiPin(repo: string | undefined): CheckResult {
  if (repo === undefined) return NO_REPO;
  const depsFile = join(repo, DEPS);
  if (!existsSync(depsFile)) return ["fail", `${DEPS} is missing`];
  const recorded = depsPiPins(readFileSync(depsFile, "utf8"));
  const seen = new Map<string, string>();
  const packagesDir = join(repo, "packages");
  for (const pkg of readdirSync(packagesDir)) {
    const manifestPath = join(packagesDir, pkg, "package.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = readJson(manifestPath) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...manifest.dependencies, ...manifest.devDependencies };
    for (const [name, version] of Object.entries(deps)) {
      if (!PI.test(name)) continue;
      const want = recorded.get(name);
      if (want === undefined)
        return ["fail", `packages/${pkg} depends on ${name}; ${DEPS} has no row`];
      if (version !== want)
        return ["fail", `packages/${pkg} pins ${name} ${version}; ${DEPS} records ${want}`];
      const installedPath = join(packagesDir, pkg, "node_modules", name, "package.json");
      if (!existsSync(installedPath))
        return ["fail", `${name} is not installed for packages/${pkg}; run pnpm install`];
      const installed = (readJson(installedPath) as { version?: string }).version;
      if (installed !== want)
        return [
          "fail",
          `packages/${pkg} has ${name} ${installed} installed; ${DEPS} records ${want}`,
        ];
      seen.set(name, want);
    }
  }
  if (seen.size === 0) return ["fail", "no workspace package depends on pi"];
  const list = [...seen].map(([n, v]) => `${n.replace("@earendil-works/", "")} ${v}`).sort();
  return ["ok", `${list.join(", ")}: package.json pins and installed copies match ${DEPS}`];
}

/** Node 24 or later. */
export function checkNode(version: string): CheckResult {
  const major = Number(version.split(".")[0]);
  return major >= MIN_NODE_MAJOR
    ? ["ok", `Node ${version}`]
    : [
        "fail",
        `Node ${version}; Engram needs ${MIN_NODE_MAJOR} or later (node:sqlite, type stripping)`,
      ];
}

export async function doctorCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(
    args,
    {
      db: STORE_OPTIONS.db,
      policy: STORE_OPTIONS.policy,
      root: STORE_OPTIONS.root,
      json: STORE_OPTIONS.json,
    },
    false,
  );
  const at = io.now();
  // Outside the checks: a bad --db or ENGRAM_DB_URL is usage (exit 2), not a failed check.
  const target = dbTarget(values.db, io);
  const root = values.root === undefined ? undefined : resolve(io.cwd, values.root);
  const checks: Check[] = [];
  const check = async (name: string, fn: () => CheckResult | Promise<CheckResult>) => {
    try {
      const [status, detail] = await fn();
      checks.push({ status, name, detail });
    } catch (e) {
      checks.push({ status: "fail", name, detail: oneLine(e) });
    }
  };

  await check("log", () => checkLog(target));
  await check("policy", () => {
    const p = loadPolicy(values.policy, io.cwd);
    return ["ok", `${p.id} v${p.version} loads and validates`];
  });
  await check("store", async () => {
    if (root === undefined) return ["skip", "no --root given"];
    // The folder itself; the adapter check below lists its memories.
    if (!(await stat(root)).isDirectory()) return ["fail", `${root} is not a folder`];
    await access(root, constants.R_OK);
    return ["ok", `${root} is a readable folder`];
  });
  await check("adapter files", () => checkFilesAdapter(root, at, io.newId));
  await check("adapter mem0", () => checkMem0Adapter(at, io.newId));
  await check("adapter letta", () => ["skip", "not implemented yet (card A2)"]);
  await check("provider keys", () => checkProviderKeys(io.repo, io.env));
  await check("benchmark pins", () => checkBenchmarkPins(io.repo));
  await check("pi pin", () => checkPiPin(io.repo));
  await check("node", () => checkNode(io.nodeVersion));

  const failed = checks.filter((c) => c.status === "fail").length;
  if (values.json) io.out(`${JSON.stringify({ checks, failed }, null, 2)}\n`);
  else {
    const lines = checks.map((c) => `${c.status.padEnd(5)}${c.name.padEnd(16)}${c.detail}`);
    lines.push(
      failed === 0 ? "doctor: all checks passed" : `doctor: ${plural(failed, "check")} failed`,
    );
    io.out(`${lines.join("\n")}\n`);
  }
  return failed === 0 ? 0 : 1;
}
