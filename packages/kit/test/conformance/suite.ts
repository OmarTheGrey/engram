// The conformance suite for adapters built on the kit (card E8.14), exported
// as `@engram/kit/conformance` so each adapter package runs it in its own
// tests. It is test code: it opens an in-memory workspace over the fake
// store, which no adapter may do. Each case is plain async code that throws
// on failure, so a test file registers `for (const c of cases) test(c.name, c.run)`.
//
// What every adapter on the kit must show:
//   1. its package reaches no store and no pi by what it depends on and
//      imports: a static check over its dependency closure (every package it
//      depends on, and theirs) and over the import statements of every
//      workspace package in that closure. This is the suite's claim about
//      store access; it is static, so an adapter that computes a module name
//      at run time is out of its reach (review finding E8.14-3);
//   2. a read shows the reader's own memory and nothing from a scope it may
//      not read;
//   3. a denied write surfaces as the kit's typed rejection, EngramRejected,
//      carrying the deny event the log holds, and the store gets nothing;
//   4. the actor cannot be changed by model output: built from an actor whose
//      source is `user`, a write or read whose model-supplied input names
//      another actor, source, owner or provenance is still made as that
//      actor with source `model`, and changing the actor object after
//      construction changes nothing (review finding E8.14-2).
//
// The first version of this suite also checked at run time that every store
// call came inside a plane request. No adapter can fail that check, since the
// suite's store is reachable only through the plane, so it was dropped (E8.14-3).
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { createFakeAdapter } from "@engram/adapters";
import { loadPreset, type MemoryItem, migrate, openSqlite } from "@engram/core";
import { createEngramClient } from "@engram/sdk";
import { createApp, workspaceOf } from "@engram/server";
import { EngramRejected, type KitOptions } from "../../src/index.ts";

/** One adapter under test, driven as its framework would drive it. */
export interface KitAdapterSubject {
  name: string;
  /** The adapter package's folder: its package.json and `src/` are checked statically. */
  root: string;
  /** Builds the adapter as its users would, from the kit's options. */
  create(options: KitOptions): AdapterInstance;
}

export interface AdapterInstance {
  /**
   * A write as the model asks for it. `input` is model output: `content` and
   * `scope`, and whatever else a model may put in a tool call. Resolves when
   * stored; rejects with whatever the adapter surfaces for a refusal.
   */
  write(input: Record<string, unknown>): Promise<unknown>;
  /** A read as the model asks for it (`query`, and anything else); resolves with what the model is shown. */
  read(input: Record<string, unknown>): Promise<string>;
}

export interface ConformanceCase {
  name: string;
  run(): Promise<void>;
}

export const NOW = "2026-11-01T12:00:00.000Z";
/**
 * The actor every subject is built with: may write into its person scope as
 * a model, not into the team. Its source is `user`, so an adapter that keeps
 * the caller's source instead of `model` is caught (E8.14-2).
 */
export const BOUND = {
  id: "person:dana",
  level: "person" as const,
  memberships: ["person:dana", "team:platform"],
  source: "user" as const,
};
/** What a model might put in a tool call to act as someone else. */
export const FORGED = {
  actor: { id: "person:root", level: "org", memberships: ["org", "person:eve"], source: "user" },
  source: "user",
  owner: "person:eve",
  provenance: { kind: "user", ref: "forged", actor: "person:root" },
  as: "person:root",
};

const DANA_FACT = "dana deploys the platform on fridays";
const EVE_FACT = "eve deploys payroll in secret";

class ConformanceFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConformanceFailure";
  }
}
function check(ok: boolean, message: string): asserts ok {
  if (!ok) throw new ConformanceFailure(message);
}

/** A workspace over the fake store, the medium preset and a fixed clock. */
function workspace() {
  const db = openSqlite(":memory:");
  migrate(db);
  const store = createFakeAdapter();
  let n = 0;
  const newId = () => `01970000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
  const ws = workspaceOf({ db, adapter: store, policy: loadPreset("medium"), newId });
  const app = createApp(ws, { port: 7313, now: () => NOW });
  const client = createEngramClient({
    baseUrl: "http://127.0.0.1:7313",
    fetch: async (request) => app.fetch(request),
  });
  return { db, store, ws, client };
}

/** Seeds what a user wrote, through the plane: dana's fact in her scope and eve's in hers. */
async function seed(w: ReturnType<typeof workspace>) {
  const item = (n: number, scope: string, owner: string, content: string) =>
    ({
      id: `01970000-0000-7000-8000-${String(900 + n).padStart(12, "0")}`,
      class: "semantic",
      scope,
      owner,
      content,
      provenance: { kind: "user", ref: "seed", hash: `sha256:${"0".repeat(64)}`, actor: owner },
      confidence: 0.9,
      valid_from: "2026-10-01T00:00:00.000Z",
      valid_to: null,
      ttl: null,
      grants: [],
      version: 1,
      lineage: [],
      status: "active",
      store_ref: null,
      schema_version: 1,
    }) as MemoryItem;
  const eve = { id: "person:eve", level: "person" as const, memberships: ["person:eve"] };
  await w.ws.plane.write(BOUND, item(1, "person:dana", BOUND.id, DANA_FACT), NOW);
  await w.ws.plane.write({ ...eve, source: "user" }, item(2, "person:eve", eve.id, EVE_FACT), NOW);
}

function build(subject: KitAdapterSubject, w: ReturnType<typeof workspace>) {
  const actor = { ...BOUND, memberships: [...BOUND.memberships] };
  let n = 0;
  const instance = subject.create({
    client: w.client,
    actor,
    now: () => NOW,
    newId: () => `01970000-0000-7000-8000-${String(500 + ++n).padStart(12, "0")}`,
  });
  return { instance, actor };
}

async function rejection(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => undefined,
    (e: unknown) => e,
  );
}

/**
 * Packages an adapter's dependency closure must not hold: stores and store
 * SDKs, the log's drivers, and the surfaces that open a workspace (the
 * server, the CLI), which reach the log and the store themselves (E8.14-3).
 */
export const FORBIDDEN_DEPENDENCIES = [
  "@engram/adapters",
  "@engram/server",
  "@engram/cli",
  "mem0ai",
  "better-sqlite3",
  "@letta-ai/letta-client",
  "embedded-postgres",
  "pg",
  "postgres",
];
/** And no pi package, by ADR 0033 (E8.14-4). */
const forbiddenDependency = (name: string) =>
  FORBIDDEN_DEPENDENCIES.includes(name) || name.startsWith("@earendil-works/");

/** Modules a workspace package in the closure must not import. */
export const FORBIDDEN_IMPORTS = [
  ...FORBIDDEN_DEPENDENCIES,
  "node:fs",
  "node:fs/promises",
  "fs",
  "fs/promises",
  "node:sqlite",
  "node:child_process",
  "child_process",
];

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|mjs)$/.test(name) ? [path] : [];
  });
}

/** Every import or export-from specifier in `text`, with whether it is type-only. */
function imports(text: string): { spec: string; typeOnly: boolean }[] {
  const found: { spec: string; typeOnly: boolean }[] = [];
  const statement = /\b(import|export)\s+(type\s+)?[^;'"]*?\bfrom\s*["']([^"']+)["']/g;
  for (const m of text.matchAll(statement))
    found.push({ spec: m[3] as string, typeOnly: m[2] !== undefined });
  for (const m of text.matchAll(/\bimport\s*["']([^"']+)["']/g))
    found.push({ spec: m[1] as string, typeOnly: false });
  for (const m of text.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']/g))
    found.push({ spec: m[1] as string, typeOnly: false });
  return found;
}

const packageName = (spec: string) =>
  spec
    .split("/")
    .slice(0, spec.startsWith("@") ? 2 : 1)
    .join("/");

/** The workspace's packages by name, found from the folder holding pnpm-workspace.yaml. */
function workspacePackages(from: string): Map<string, string> {
  let dir = from;
  while (!existsSync(join(dir, "pnpm-workspace.yaml")) && dirname(dir) !== dir) dir = dirname(dir);
  const found = new Map<string, string>();
  for (const parent of [join(dir, "packages"), join(dir, "sdk")])
    for (const name of existsSync(parent) ? readdirSync(parent) : []) {
      const pkg = join(parent, name, "package.json");
      if (existsSync(pkg))
        found.set(JSON.parse(readFileSync(pkg, "utf8")).name, join(parent, name));
    }
  return found;
}

/** Where an external package `name` resolves from `dir`: node_modules lookup, pnpm links followed. */
function externalPackage(name: string, dir: string): string | undefined {
  let at = dir;
  for (;;) {
    const candidate = join(at, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
    if (dirname(at) === at) return undefined;
    at = dirname(at);
  }
}

/** What the static check finds wrong with an adapter package: empty when it passes. */
export function staticViolations(root: string): string[] {
  const problems: string[] = [];
  const workspace = workspacePackages(root);
  type Node = { dir: string; path: string; inWorkspace: boolean };
  const seen = new Set<string>();
  const queue: Node[] = [{ dir: root, path: "(the adapter)", inWorkspace: true }];
  while (queue.length > 0) {
    const node = queue.shift() as Node;
    if (seen.has(node.dir)) continue;
    seen.add(node.dir);
    const pkg = JSON.parse(readFileSync(join(node.dir, "package.json"), "utf8")) as Record<
      string,
      Record<string, string> | undefined
    >;
    for (const field of ["dependencies", "peerDependencies", "optionalDependencies"])
      for (const dep of Object.keys(pkg[field] ?? {})) {
        if (forbiddenDependency(dep)) {
          problems.push(`${node.path} ${field} names ${dep}`);
          continue;
        }
        // Core is taken for its types only (the import check below holds every
        // workspace package in the closure to that), so its own dependencies,
        // the log's drivers among them, are not followed.
        if (dep === "@engram/core") continue;
        const inWorkspace = workspace.has(dep);
        const dir = inWorkspace ? workspace.get(dep) : externalPackage(dep, node.dir);
        if (dir !== undefined) queue.push({ dir, path: `${node.path} > ${dep}`, inWorkspace });
      }
    if (!node.inWorkspace) continue;
    for (const file of sourceFiles(join(node.dir, "src"))) {
      const text = readFileSync(file, "utf8");
      for (const { spec, typeOnly } of imports(text)) {
        const name = packageName(spec);
        if (FORBIDDEN_IMPORTS.includes(spec) || FORBIDDEN_IMPORTS.includes(name))
          problems.push(`${file} imports ${spec}`);
        else if (name.startsWith("@earendil-works/")) problems.push(`${file} imports ${spec}`);
        // Core opens logs and builds planes over stores; the closure takes its types only.
        if (name === "@engram/core" && !typeOnly)
          problems.push(`${file} imports @engram/core at run time`);
      }
      // A built-in module fetched at run time is an import the check above cannot see.
      if (/\bgetBuiltinModule\b/.test(text)) problems.push(`${file} uses process.getBuiltinModule`);
    }
  }
  return problems;
}

export function kitConformance(subject: KitAdapterSubject): ConformanceCase[] {
  const c = (name: string, run: () => Promise<void>) => ({
    name: `${subject.name}: ${name}`,
    run,
  });
  return [
    c("its dependency closure and imports reach no store and no pi", async () => {
      const problems = staticViolations(subject.root);
      check(problems.length === 0, `store or pi reached: ${problems.join("; ")}`);
    }),

    c("a read shows the reader's own memory and nothing another person's scope holds", async () => {
      const w = workspace();
      await seed(w);
      const { instance } = build(subject, w);
      const shown = await instance.read({ query: "deploys" });
      check(shown.includes(DANA_FACT), `the read did not show the reader's own fact: ${shown}`);
      check(!shown.includes("payroll"), `the read showed another person's fact: ${shown}`);
    }),

    c("a denied write surfaces as EngramRejected carrying the log's deny event", async () => {
      const w = workspace();
      const { instance } = build(subject, w);
      // A member of team:platform, but the medium preset takes no model writes there.
      const error = await rejection(
        instance.write({ content: "the team deploys on fridays", scope: "team:platform" }),
      );
      check(error instanceof EngramRejected, `the refusal surfaced as ${String(error)}`);
      const last = w.ws.plane.events().at(-1);
      check(
        last !== undefined && error.event.id === last.id && error.event.decision === "deny",
        `the rejection carries ${JSON.stringify(error.event)}, the log ends with ${JSON.stringify(last)}`,
      );
      check(error.event.actor === BOUND.id, `the deny event names ${error.event.actor}`);
      check((await w.store.list("team:platform")).length === 0, "the store got the denied item");
      // A write into another person's scope is refused the same way.
      const outsider = await rejection(instance.write({ content: "x", scope: "person:eve" }));
      check(
        outsider instanceof EngramRejected,
        `a write into another person's scope surfaced as ${String(outsider)}`,
      );
    }),

    c("model output cannot change the actor, its source or the item's provenance", async () => {
      const w = workspace();
      await seed(w);
      const { instance, actor } = build(subject, w);
      await instance.write({ ...FORGED, content: "dana likes tea", scope: "person:dana" });
      const write = w.ws.plane.events().at(-1);
      check(
        write?.op === "write" && write.decision === "allow",
        `the write was ${JSON.stringify(write)}`,
      );
      check(write.actor === BOUND.id, `the write was made as ${write.actor}`);
      check(write.item?.owner === BOUND.id, `the item's owner is ${write.item?.owner}`);
      check(
        write.item?.provenance.kind === "model" && write.item.provenance.actor === BOUND.id,
        `the item's provenance is ${JSON.stringify(write.item?.provenance)}; built from a user-sourced actor, the adapter must write as source model`,
      );
      const shown = await instance.read({ ...FORGED, query: "deploys payroll secret" });
      const read = w.ws.plane.events().at(-1);
      check(read?.op === "read" && read.actor === BOUND.id, `the read was made as ${read?.actor}`);
      check(!shown.includes("payroll"), `a forged reader saw another person's fact: ${shown}`);
      // The object the adapter was built from, changed afterwards, changes nothing.
      actor.memberships.push("person:eve");
      (actor as { id: string }).id = "person:eve";
      const after = await rejection(instance.write({ content: "eve's note", scope: "person:eve" }));
      check(
        after instanceof EngramRejected,
        "a write after the actor object changed was not refused",
      );
      check(after.event.actor === BOUND.id, `the actor became ${after.event.actor}`);
    }),
  ];
}
