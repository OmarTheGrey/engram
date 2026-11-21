// The conformance suite for adapters built on the kit (card E8.14), exported
// as `@engram/kit/conformance` so each adapter package runs it in its own
// tests. It is test code: it opens an in-memory workspace over the fake
// store, which no adapter may do. Each case is plain async code that throws
// on failure, so a test file registers `for (const c of cases) test(c.name, c.run)`.
//
// What every adapter on the kit must show:
//   1. no path reaches a store except through the plane: at run time every
//      store call happens inside a request the plane is serving, every item
//      the store holds has the plane's allow event, and the adapter's own
//      source and package reach no store, store SDK, file system or log
//      (a static check of its dependencies and import statements);
//   2. a denied write surfaces as the kit's typed rejection, EngramRejected,
//      carrying the deny event the log holds, and the store gets nothing;
//   3. the actor cannot be changed by model output: a write or read whose
//      model-supplied input names another actor, source, owner or provenance
//      is still made as the actor given at construction, source `model`, and
//      changing that actor object after construction changes nothing.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { type Adapter, createFakeAdapter } from "@engram/adapters";
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
/** The actor every subject is built with: may write into its person scope as a model, not into the team. */
export const BOUND = {
  id: "person:dana",
  level: "person" as const,
  memberships: ["person:dana", "team:platform"],
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

/** A workspace over the fake store, whose every store call must come inside a plane request. */
function workspace() {
  const db = openSqlite(":memory:");
  migrate(db);
  const store = createFakeAdapter();
  const outside: string[] = [];
  let serving = 0;
  // A fake around the fake: each store method notes a call made while the
  // plane serves no request (rule 2).
  const guarded = Object.create(store) as Adapter;
  for (const method of ["read", "write", "delete", "list", "search", "history"] as const) {
    const inner = (store as unknown as Record<string, unknown>)[method];
    if (typeof inner !== "function") continue;
    (guarded as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => {
      if (serving === 0) outside.push(method);
      return (inner as (...a: unknown[]) => unknown).apply(store, args);
    };
  }
  let n = 0;
  const newId = () => `01970000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
  const ws = workspaceOf({ db, adapter: guarded, policy: loadPreset("medium"), newId });
  const app = createApp(ws, { port: 7313, now: () => NOW });
  /** Runs `call` as the plane serving a request: the store calls it makes are the plane's. */
  const inPlane = async <T>(call: () => Promise<T>): Promise<T> => {
    serving++;
    try {
      return await call();
    } finally {
      serving--;
    }
  };
  const client = createEngramClient({
    baseUrl: "http://127.0.0.1:7313",
    fetch: (request) => inPlane(() => app.fetch(request)),
  });
  return { db, store, ws, client, outside, inPlane };
}

/** Seeds what a user wrote: dana's fact in her scope and eve's in hers. */
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
  const dana = { ...BOUND, source: "user" as const };
  const eve = { id: "person:eve", level: "person" as const, memberships: ["person:eve"] };
  // Through the plane directly: the seed is not the adapter's call.
  await w.inPlane(() =>
    w.ws.plane.write(dana, item(1, "person:dana", dana.id, DANA_FACT), NOW),
  );
  await w.inPlane(() =>
    w.ws.plane.write({ ...eve, source: "user" }, item(2, "person:eve", eve.id, EVE_FACT), NOW),
  );
}

function build(subject: KitAdapterSubject, w: ReturnType<typeof workspace>, actor = { ...BOUND }) {
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

/** Store packages and modules an adapter on the kit must not depend on or import. */
export const FORBIDDEN_DEPENDENCIES = [
  "@engram/adapters",
  "mem0ai",
  "better-sqlite3",
  "@letta-ai/letta-client",
  "embedded-postgres",
  "pg",
  "postgres",
];
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

/** What the static check finds wrong with an adapter package: empty when it passes. */
export function staticViolations(root: string): string[] {
  const problems: string[] = [];
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Record<
    string,
    Record<string, string> | undefined
  >;
  for (const field of ["dependencies", "peerDependencies", "optionalDependencies"])
    for (const dep of Object.keys(pkg[field] ?? {}))
      if (FORBIDDEN_DEPENDENCIES.includes(dep)) problems.push(`${field} names ${dep}`);
  for (const file of sourceFiles(join(root, "src")))
    for (const { spec, typeOnly } of imports(readFileSync(file, "utf8"))) {
      const name = spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/");
      if (FORBIDDEN_IMPORTS.includes(spec) || FORBIDDEN_IMPORTS.includes(name))
        problems.push(`${file} imports ${spec}`);
      // Core opens logs and builds planes over stores; an adapter takes its types only.
      if (name === "@engram/core" && !typeOnly)
        problems.push(`${file} imports @engram/core at run time`);
    }
  return problems;
}

export function kitConformance(subject: KitAdapterSubject): ConformanceCase[] {
  const c = (name: string, run: () => Promise<void>) => ({
    name: `${subject.name}: ${name}`,
    run,
  });
  return [
    c("its package and source reach no store except through the client", async () => {
      const problems = staticViolations(subject.root);
      check(problems.length === 0, `store reached outside the plane: ${problems.join("; ")}`);
    }),

    c("every store call happens inside a plane request, and the store holds only what the plane allowed", async () => {
      const w = workspace();
      await seed(w);
      const { instance } = build(subject, w);
      await instance.write({ content: "dana prefers short summaries", scope: "person:dana" });
      const shown = await instance.read({ query: "deploys" });
      check(w.outside.length === 0, `store called outside the plane: ${w.outside.join(", ")}`);
      check(shown.includes(DANA_FACT), `the read did not show the reader's own fact: ${shown}`);
      check(!shown.includes("payroll"), `the read showed another person's fact: ${shown}`);
      const allowed = new Set(
        w.ws.plane
          .events()
          .filter((e) => e.op === "write" && e.decision === "allow")
          .map((e) => e.item_id),
      );
      for (const scope of ["person:dana", "person:eve", "team:platform"])
        for (const held of await w.store.list(scope))
          check(allowed.has(held.id), `the store holds ${held.id}, which no allow event wrote`);
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
      check(
        (await w.store.list("team:platform")).length === 0,
        "the store got the denied item",
      );
      // An unknown scope is refused the same way.
      const outsider = await rejection(instance.write({ content: "x", scope: "person:eve" }));
      check(outsider instanceof EngramRejected, `a write into another person's scope surfaced as ${String(outsider)}`);
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
        `the item's provenance is ${JSON.stringify(write.item?.provenance)}`,
      );
      const shown = await instance.read({ ...FORGED, query: "deploys payroll secret" });
      const read = w.ws.plane.events().at(-1);
      check(read?.op === "read" && read.actor === BOUND.id, `the read was made as ${read?.actor}`);
      check(!shown.includes("payroll"), `a forged reader saw another person's fact: ${shown}`);
      // The object the adapter was built from, changed afterwards, changes nothing.
      actor.memberships.push("person:eve");
      (actor as { id: string }).id = "person:eve";
      const after = await rejection(instance.write({ content: "eve's note", scope: "person:eve" }));
      check(after instanceof EngramRejected, "a write after the actor object changed was not refused");
      check(after.event.actor === BOUND.id, `the actor became ${after.event.actor}`);
    }),
  ];
}
