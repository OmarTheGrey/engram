// Card E8.16 over the CLI, the TUI, the HTTP API and MCP, on the canary
// workspace of packages/server/test/leakage-kit.ts over the files store.
//
// Parity. Each operation is run from the same seeded state, with the same
// clock and the same ids, through the HTTP API (the route, a body written
// here by hand), `engram <argv>` in process, `engram <argv> --server` against
// a server over the same workspace, and the TUI (its runner, which runs the
// same argv through the CLI's own `run`; packages/cli/test/tui/parity.test.ts
// shows each TUI action is that argv). The events each logged and the
// decisions, reasons and rule ids each answered are compared field by field;
// the CLI and the TUI print the same bytes. A model's operations (source
// model) are run through MCP and the HTTP API, and matched against the file
// snapshot the pi extension's parity suite matches too (MODEL_PARITY).
//
// Leakage. Every command of the registry that reaches the plane is run as
// each probe actor, through the CLI and through the TUI's runner, and no
// output carries a canary its actor may not see; the TUI's own screen, after
// a read, is scanned as drawn. A command with no probe and no listed
// exemption fails the suite. Parity tests in the manner of plur-ai/plur
// (commit 7c6aa73ba14e, Apache-2.0; idea only): one operation per surface,
// compared field by field.
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Actor, allEvents, type MemoryEvent, openSqlite } from "@engram/core";
import { createEngramClient } from "@engram/sdk";
import { createApp, type Listening, listen, openWorkspace } from "@engram/server";
import { beforeAll, describe, expect, it } from "vitest";
import { mcpAgent } from "../../mcp/test/leakage-agent.ts";
import {
  byLabel,
  CANARIES,
  CONTROL,
  contentOf,
  DANA,
  LEE,
  leaksIn,
  MISSING_ID,
  MISSING_READ,
  MODEL_OPS,
  MODEL_PARITY,
  NOW,
  noncesIn,
  type OracleRecord,
  opRecord,
  type ParityRecord,
  PROBE_ACTORS,
  type ProbeActor,
  type ProbeRecord,
  recordProbes,
  SAM,
  type Seeded,
  seedCanaries,
} from "../../server/test/leakage-kit.ts";
import { type CommandSpec, REGISTRY } from "../src/registry.ts";
import { type Io, run } from "../src/run.ts";
import { specOfWords } from "../src/tui/overlays.ts";
import { runCommand } from "../src/tui/runner.ts";
import { HOME, REPO, tempDir } from "./helpers.ts";
import { startHarness } from "./tui/harness.ts";

const CTRL_S = "\x13";
const PGDN = "\x1b[6~";
const seedId = (n: number) => `01960000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const runId = (n: number) => `01950000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const WS: Record<string, string> = { root: "mem", owner: "dana", db: "engram.db" };

let template: string;
let seeded: Seeded;

/** The canary workspace, seeded once through the workspace the CLI opens, then copied for each run. */
beforeAll(async () => {
  template = await tempDir();
  let n = 0;
  const ws = openWorkspace({
    root: join(template, "mem"),
    owner: "dana",
    db: join(template, "engram.db"),
    cwd: template,
    home: HOME,
    env: {},
    newId: () => seedId(++n),
  });
  ws.open();
  try {
    seeded = await seedCanaries(ws.deps);
  } finally {
    ws.close();
  }
});

async function fresh(): Promise<string> {
  const dir = await tempDir();
  cpSync(template, dir, { recursive: true });
  return dir;
}

/** An Io as main.ts builds one, on `dir`, at the canary clock, with ids from `ids`. */
function io(dir: string, ids: { n: number }) {
  const out = { out: "", err: "" };
  const value: Io = {
    out: (s) => {
      out.out += s;
    },
    err: (s) => {
      out.err += s;
    },
    cwd: dir,
    home: HOME,
    now: () => NOW,
    newId: () => runId(++ids.n),
    env: {},
    nodeVersion: process.versions.node,
    repo: REPO,
  };
  return { io: value, out };
}

/** The workspace flags `argv`'s command takes, as the TUI's workspace adds them. */
function withWorkspace(argv: readonly string[]): string[] {
  const spec = specOfWords(argv) as CommandSpec;
  const flags = Object.entries(WS).flatMap(([k, v]) =>
    Object.hasOwn(spec.options, k) ? [`--${k}`, v] : [],
  );
  return [...argv, ...flags];
}

/** The actor flags for `words`' command, when it takes them (simulate and policy take none). */
const actorFlags = (words: readonly string[], a: Actor) =>
  Object.hasOwn((specOfWords(words) as CommandSpec).options, "as") ? as(a) : [];

const as = (a: Actor) => [
  ...["--as", a.id, "--level", a.level],
  ...a.memberships.flatMap((m) => ["--member", m]),
];

/** A workspace the server opens over `dir`, as `engram serve` would. */
function workspaceAt(dir: string, ids: { n: number }) {
  const ws = openWorkspace({
    root: join(dir, "mem"),
    owner: "dana",
    db: join(dir, "engram.db"),
    cwd: dir,
    home: HOME,
    env: {},
    newId: () => runId(++ids.n),
  });
  ws.open();
  return ws;
}

/** The events the log at `dir` holds after the seed. */
function delta(dir: string): MemoryEvent[] {
  const db = openSqlite(join(dir, "engram.db"));
  try {
    return allEvents(db).slice(seeded.events);
  } finally {
    db.close();
  }
}

/** Every value under `key` anywhere in `value`, as JSON text, sorted and unique. */
function under(value: unknown, key: string): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v !== null && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        if (k === key && typeof x === "string") found.add(x);
        walk(x);
      }
  };
  walk(value);
  return [...found].sort();
}

/** What an answer reported: every decision, reason and rule id in it. */
const reported = (json: unknown) => ({
  decision: under(json, "decision"),
  reason: under(json, "reason"),
  policy_id: under(json, "policy_id"),
});

const iso = (t: string) => new Date(t).toISOString();
const GRANT = "person:sam,class=semantic,mode=read,expires=2026-12-01T00:00:00Z";
const W1 = runId(900);
const W2 = runId(901);

/** A user-written item as the CLI's write builds it, but for the provenance label. */
const userItem = (id: string, scope: string, content: string, confidence = 0.9) => ({
  id,
  class: "semantic",
  scope,
  owner: DANA.id,
  content,
  provenance: { kind: "user", ref: "parity", hash: `sha256:${"0".repeat(64)}`, actor: DANA.id },
  confidence,
  valid_from: iso(NOW),
  valid_to: null,
  ttl: null,
  grants: [],
  version: 1,
  lineage: [],
  status: "active",
  store_ref: null,
  schema_version: 1,
});

interface UserOp {
  name: string;
  argv: string[];
  http: { path: string; body: unknown };
}

/** The user's operations, each with its command line and the API call it means. */
const USER_OPS = (readId: string): UserOp[] => [
  {
    name: "write, allowed",
    argv: ["write", "--id", W1, "--content", "parity: dana's note", ...as(DANA)],
    http: {
      path: "/items",
      body: { actor: DANA, item: userItem(W1, "person:dana", "parity: dana's note") },
    },
  },
  {
    name: "write, denied by the team floor",
    argv: [
      ...["write", "--id", W2, "--content", "parity: a guess", "--scope", "team:x"],
      ...["--confidence", "0.1", ...as(DANA)],
    ],
    http: {
      path: "/items",
      body: { actor: DANA, item: userItem(W2, "team:x", "parity: a guess", 0.1) },
    },
  },
  {
    name: "read, as the store's owner",
    argv: ["read", "canary", ...as(DANA)],
    http: { path: "/read", body: { actor: DANA, text: "canary" } },
  },
  {
    name: "read by id, as a grantee",
    argv: ["read", "--item", byLabel("granted-sam").id, ...as(SAM)],
    http: { path: `/read/${byLabel("granted-sam").id}`, body: { actor: SAM } },
  },
  {
    name: "explain, as the reader",
    argv: ["explain", readId, ...as(DANA)],
    http: { path: `/explain/${readId}`, body: { actor: DANA } },
  },
  {
    name: "explain --absent, as the owner",
    argv: ["explain", "--absent", byLabel("dana-person").id, "canary", ...as(DANA)],
    http: {
      path: "/explain-absent",
      body: { actor: DANA, item_id: byLabel("dana-person").id, text: "canary" },
    },
  },
  {
    name: "promote, refused without a review",
    argv: ["promote", byLabel("dana-person").id, "--to", "team:x", ...as(DANA)],
    http: {
      path: "/promote",
      body: { actor: DANA, item_id: byLabel("dana-person").id, to: "team:x" },
    },
  },
  {
    name: "grants, added by the owner",
    argv: ["grants", byLabel("dana-person").id, "--add", GRANT, ...as(DANA)],
    http: {
      path: "/grants",
      body: {
        actor: DANA,
        item_id: byLabel("dana-person").id,
        add: [{ to: SAM.id, class: "semantic", mode: "read", expires: "2026-12-01T00:00:00Z" }],
      },
    },
  },
  {
    name: "who-can-read, as the owner",
    argv: ["who-can-read", byLabel("dana-person").id, ...as(DANA)],
    http: { path: "/who-can-read/item", body: { actor: DANA, item_id: byLabel("dana-person").id } },
  },
  {
    name: "events, as a member",
    argv: ["events", ...as(LEE)],
    http: { path: "/events", body: { actor: LEE } },
  },
  {
    name: "scopes, as a grantee",
    argv: ["scopes", ...as(SAM)],
    http: { path: "/scopes", body: { actor: SAM } },
  },
  {
    name: "supersede, the plan",
    argv: ["supersede", byLabel("superseded-new").id, ...as(DANA)],
    http: {
      path: "/supersede",
      body: { actor: DANA, item_id: byLabel("superseded-new").id, accept: [] },
    },
  },
  {
    name: "retain, as a member",
    argv: ["retain", "--scope", "person:dana", ...as(DANA)],
    http: { path: "/retain", body: { actor: DANA, scope: "person:dana" } },
  },
  {
    name: "lint, as a member",
    argv: ["lint", "--scope", "team:x", ...as(LEE)],
    http: { path: "/lint", body: { actor: LEE, scope: "team:x" } },
  },
];

type Run = { surface: string; json: unknown; out: string; events: MemoryEvent[] };

/** `op` through one surface from a fresh copy of the seeded workspace. */
async function through(surface: string, op: UserOp): Promise<Run> {
  const dir = await fresh();
  const ids = { n: 0 };
  if (surface === "http") {
    const ws = workspaceAt(dir, ids);
    const app = createApp(ws, { port: 7313, now: () => NOW });
    const response = await app.fetch(
      new Request(`http://127.0.0.1:7313/api/v1${op.http.path}`, {
        method: "POST",
        body: JSON.stringify(op.http.body),
        headers: { "content-type": "application/json" },
      }),
    );
    const text = await response.text();
    ws.close();
    expect(response.status, `${op.name}: ${text}`).toBe(200);
    return { surface, json: JSON.parse(text), out: text, events: delta(dir) };
  }
  if (surface === "cli --server") {
    const serverIds = { n: 0 };
    const ws = workspaceAt(dir, serverIds);
    const server: Listening = await listen(ws, {
      port: 0,
      now: () => NOW,
      auth: { insecureLoopback: true },
    });
    const { io: plain, out } = io(dir, ids);
    try {
      await run([...op.argv, "--server", server.url, "--json"], plain);
    } finally {
      await server.close();
      ws.close();
    }
    expect(out.err, op.name).toBe("");
    return { surface, json: JSON.parse(out.out), out: out.out, events: delta(dir) };
  }
  const argv = [...withWorkspace(op.argv), "--json"];
  const { io: plain, out } = io(dir, ids);
  const result =
    surface === "tui" ? await runCommand(argv, plain) : { code: await run(argv, plain), ...out };
  const text = result.out;
  expect(result.err, op.name).toBe("");
  return {
    surface,
    json: JSON.parse(text),
    out: text.replaceAll(dir, "<dir>").replaceAll(dir.replaceAll("\\", "\\\\"), "<dir>"),
    events: delta(dir),
  };
}

const parity: ParityRecord[] = [];
const records: ProbeRecord[] = [];
const oracles: OracleRecord[] = [];
const controls: { surface: string; found: string[] }[] = [];

describe("E8.16: one operation, the same decision on every surface", () => {
  for (const { name } of USER_OPS("<read>"))
    it(`${name}: the HTTP API, the CLI, the CLI against a server and the TUI agree`, async () => {
      const op = USER_OPS(seeded.danaReadId).find((o) => o.name === name) as UserOp;
      const runs: Run[] = [];
      for (const surface of ["http", "cli", "cli --server", "tui"])
        runs.push(await through(surface, op));
      const [http, cli, served, tui] = runs as [Run, Run, Run, Run];
      // The CLI and the TUI are the same command: the same bytes, the same log.
      expect(tui.out).toBe(cli.out);
      expect(tui.events).toEqual(cli.events);
      const blind = (r: Run) => opRecord(op.name, "", r.events as never, new Map());
      // The CLI in process is the reference; each other surface is compared with it.
      for (const r of [http, served, tui]) {
        // Each surface's answer reports the decisions its log records, and the same ones.
        const same =
          JSON.stringify(blind(r)) === JSON.stringify(blind(cli)) &&
          JSON.stringify(reported(r.json).reason) === JSON.stringify(reported(cli.json).reason);
        parity.push({ surface: r.surface, operation: op.name, same });
      }
      expect(blind(http)).toEqual(blind(cli));
      expect(blind(served)).toEqual(blind(cli));
      // The server's events are the in-process ones, byte for byte (the same ids and clock).
      expect(served.events).toEqual(cli.events);
      for (const r of [http, served, tui])
        expect(reported(r.json).reason, `${op.name}: ${r.surface}`).toEqual(
          reported(cli.json).reason,
        );
      // What each answer reports is what its log holds.
      // (The owner's sweep and adoption before a read report in their own fields.)
      const acted = cli.events.filter(
        (e) => e.actor === (op.http.body as { actor: Actor }).actor.id,
      );
      for (const e of acted) expect(reported(cli.json).reason, op.name).toContain(e.reason);
    });

  it("a model's operations: MCP and the HTTP API log the same events, and MCP matches the pi extension's snapshot", async () => {
    const agent: Actor = { ...DANA, source: "model" };
    const via = async (surface: "mcp" | "http") => {
      const dir = await fresh();
      const ids = { n: 0 };
      const ws = workspaceAt(dir, ids);
      const app = createApp(ws, { port: 7313, now: () => NOW });
      const client = createEngramClient({
        baseUrl: "http://127.0.0.1:7313",
        fetch: async (r) => app.fetch(r),
      });
      const mcp = await mcpAgent({
        client,
        actor: DANA,
        now: () => NOW,
        newId: () => runId(++ids.n),
      });
      /** The route each tool calls, with the body the MCP server builds (packages/mcp/src/server.ts). */
      const http = async (tool: string, args: Record<string, unknown>) => {
        const post = async (path: string, body: unknown) =>
          (
            await app.fetch(
              new Request(`http://127.0.0.1:7313/api/v1${path}`, {
                method: "POST",
                body: JSON.stringify(body),
                headers: { "content-type": "application/json" },
              }),
            )
          ).text();
        if (tool === "memory_write") {
          const id = runId(++ids.n);
          const item = {
            ...userItem(
              id,
              args.scope as string,
              args.content as string,
              (args.confidence as number) ?? 0.5,
            ),
            provenance: {
              kind: "model",
              ref: "parity",
              hash: `sha256:${"0".repeat(64)}`,
              actor: agent.id,
            },
          };
          return post("/items", { actor: agent, item });
        }
        if (tool === "memory_read") {
          const text = await post("/read", { actor: agent, text: args.query });
          return `read_id="${(JSON.parse(text) as { event: { id: string } }).event.id}"`;
        }
        return post(`/explain/${args.read_id as string}`, { actor: agent });
      };
      const seen = new Map<string, string>();
      const out = [];
      const raw: MemoryEvent[][] = [];
      let readId = "";
      for (const op of MODEL_OPS) {
        const before = delta(dir).length;
        const args = JSON.parse(JSON.stringify(op.args).replaceAll("{read}", readId));
        const text = surface === "mcp" ? await mcp(op.tool, args) : await http(op.tool, args);
        readId = /read_id="([^"]+)"/.exec(text)?.[1] ?? readId;
        raw.push(delta(dir).slice(before));
        out.push(opRecord(op.name, text, raw.at(-1) as never, seen));
      }
      ws.close();
      // The events alone, every id blind by its first appearance in them.
      const eventsSeen = new Map<string, string>();
      const events = raw.map(
        (e, i) => opRecord(MODEL_OPS[i]?.name ?? "", "", e as never, eventsSeen).events,
      );
      return { out, events };
    };
    const { out: mcp, events: mcpEvents } = await via("mcp");
    const { events: httpEvents } = await via("http");
    // The snapshot as committed, so each operation's record says whether it matched.
    let snapshot: { events: unknown }[] | undefined;
    try {
      snapshot = JSON.parse(readFileSync(MODEL_PARITY, "utf8"));
    } catch {
      snapshot = undefined;
    }
    for (const [i, o] of mcp.entries()) {
      const pinned = snapshot?.[i];
      parity.push({
        surface: "mcp",
        operation: o.name,
        same: pinned !== undefined && JSON.stringify(pinned) === JSON.stringify(o),
      });
      parity.push({
        surface: "http (model)",
        operation: o.name,
        same: JSON.stringify(httpEvents[i]) === JSON.stringify(mcpEvents[i]),
      });
    }
    // The HTTP API's answers are its own JSON; the events it logs are MCP's.
    expect(httpEvents).toEqual(mcpEvents);
    await expect(`${JSON.stringify(mcp, null, 2)}\n`).toMatchFileSnapshot(MODEL_PARITY);
  });
});

/** The probes of each command, by registry name: data, so a new command needs one line here or in EXEMPT. */
const ids = [...CANARIES.map((c) => c.id), MISSING_ID];
const SCOPES = ["person:dana", "team:x", "person:fred"];
const PROBES: Record<string, (a: Actor) => string[][]> = {
  read: () => [["read", "canary"], ["read"]],
  "read --item": () => ids.map((id) => ["read", "--item", id]),
  write: (a) =>
    [...SCOPES, a.memberships[0] as string].map((scope, i) => [
      ...["write", "--content", "a probe's note", "--scope", scope],
      ...["--id", runId(800 + i)],
    ]),
  check: () => ids.map((id) => ["check", "--id", id, "--content", "a probe's note"]),
  promote: () => ids.map((id) => ["promote", id, "--to", "team:x", "--review"]),
  supersede: () =>
    ids.flatMap((id) => [
      ["supersede", id],
      ["supersede", id, "--accept", id],
    ]),
  grants: (a) =>
    ids.map((id) => [
      ...["grants", id, "--add"],
      `${a.id},class=semantic,mode=read,expires=2026-12-01T00:00:00Z`,
    ]),
  explain: () => [seededReadId(), MISSING_READ].map((id) => ["explain", id]),
  // Card E2.17: why an item is not in a read, with the read's text and without.
  "explain --absent": () =>
    ids.flatMap((id) => [
      ["explain", "--absent", id],
      ["explain", "--absent", id, "canary"],
    ]),
  events: () => [["events"]],
  retain: () => [...SCOPES, "team:nobody"].map((s) => ["retain", "--scope", s]),
  lint: () => [...SCOPES, "team:nobody"].map((s) => ["lint", "--scope", s]),
  simulate: () => [["simulate"]],
  policy: () => [["policy"]],
  export: () => [["export"]],
  import: () => [["import", "--claude", "claude.txt"]],
  "who-can-read": () => [
    ...ids.map((id) => ["who-can-read", id]),
    ...[...SCOPES, "team:nobody"].map((s) => ["who-can-read", "--scope", s]),
  ],
  scopes: () => [["scopes"]],
};
const seededReadId = () => seeded.danaReadId;

/**
 * The commands no probe runs, each with its reason. An entry naming no
 * command of the registry, or one also probed, fails the suite.
 */
const EXEMPT: Record<string, { reason: string; holds?: string[] }> = {
  serve: {
    reason:
      "it serves the HTTP API, whose every route packages/server/test/leakage.test.ts probes, and this suite's parity runs the CLI against it",
  },
  mcp: {
    reason: "it serves the MCP tools, each of which packages/mcp/test/leakage.test.ts probes",
  },
  "hook claude-code": {
    reason: "it answers a hook's JSON with allow or deny and records a block; it reads no memory",
  },
  // Card E8.17.
  "hook codex": {
    reason:
      "Codex's hook: it answers a hook's JSON with allow or deny and records a block; it reads no memory",
  },
  "hook install": {
    reason:
      "it merges the hook's entry into a harness's settings file; it reaches no plane and reads no memory",
    holds: ["hook", "install", "codex", "--project", "."],
  },
  "key create": { reason: "it writes a key file; it reads no log and no store" },
  "key list": {
    reason: "it reads the key file only, masked",
    holds: ["key", "list", "--keys", "keys.json"],
  },
  "key revoke": { reason: "it writes the key file only" },
  doctor: {
    reason: "an operator's check with no actor: counts only, never content (AGENTS.md rule 12)",
  },
  "log verify": {
    reason:
      "an operator's check of the hash chain on the machine holding the log, outside the read filter by design: it names links, not content",
    holds: ["log", "verify", "--db", "engram.db"],
  },
  "log checkpoint": {
    reason: "an operator's checkpoint of the chain's head: a hash, no content",
    holds: ["log", "checkpoint", "--db", "engram.db", "--out", "checkpoint.json"],
  },
  discover: {
    reason:
      "it counts harness memory files outside every store root, never their content (card E9.10); it reaches no plane",
    holds: ["discover", "--home", ".", "--project", "."],
  },
  tui: {
    reason:
      "the TUI itself: each probe here runs through its runner as the surface tui, and its screen after a read is scanned below",
  },
};

/** The commands with neither a probe nor an exemption, and the stale entries. */
function coverage(names: readonly string[], probes: object, exempt: object) {
  return {
    unprobed: names.filter((n) => !Object.hasOwn(probes, n) && !Object.hasOwn(exempt, n)),
    stale: [...new Set([...Object.keys(probes), ...Object.keys(exempt)])].filter(
      (n) => !names.includes(n) || (Object.hasOwn(probes, n) && Object.hasOwn(exempt, n)),
    ),
  };
}

/**
 * Every probe of every command as `probe`, through the CLI or the TUI's
 * runner, in the three passes the HTTP suite uses: the commands naming no id
 * first, so none may show a canary id; then each naming command, which may
 * echo its own ids; then the first again, which may echo the ids the actor's
 * own events named, never a nonce. Every probed command must run at least
 * once, and none may end in a usage error.
 */
async function probeAll(probe: ProbeActor, surface: "cli" | "tui") {
  const dir = await fresh();
  writeFileSync(join(dir, "claude.txt"), "- a probe's pasted memory\n");
  const ids = { n: 0 };
  const leaks: string[] = [];
  const outs = new Map<string, string[]>();
  const named = (words: readonly string[]) => words.filter((w) => /^[0-9a-f]{8}-/.test(w));
  const all = Object.entries(PROBES).flatMap(([name, make]) =>
    make(probe.actor).map((words) => ({ name, words })),
  );
  const naming = all.filter((p) => named(p.words).length > 0);
  const plainCalls = all.filter((p) => named(p.words).length === 0);
  const asked = naming.flatMap((p) => named(p.words));
  const passes = [
    { calls: plainCalls, echo: (_: readonly string[]) => [] as string[] },
    { calls: naming, echo: named },
    { calls: plainCalls, echo: (_: readonly string[]) => asked },
  ];
  for (const { calls, echo } of passes)
    for (const { name, words } of calls) {
      const argv = withWorkspace([...words, ...actorFlags(words, probe.actor)]);
      const { io: plain, out } = io(dir, ids);
      const r =
        surface === "tui"
          ? await runCommand(argv, plain)
          : { code: await run(argv, plain), ...out };
      expect(r.code, `${argv.join(" ")}: ${r.err}`).toBeLessThan(2);
      outs.set(name, [...(outs.get(name) ?? []), r.out]);
      const leaked = leaksIn(`${r.out}\n${r.err}`, probe, echo(words));
      records.push({ surface, probe: name, actor: probe.name, leaked });
      if (leaked.length > 0) leaks.push(`${argv.join(" ")}: ${leaked.join(", ")}: ${r.out}`);
    }
  expect(
    Object.keys(PROBES).filter((n) => !outs.has(n)),
    "commands never run",
  ).toEqual([]);
  return { leaks, outs };
}

/** No actor may see any canary: what an exempt command shows must carry none. */
const NOBODY: ProbeActor = {
  name: "nobody",
  actor: { id: "person:nobody", level: "person", memberships: ["person:nobody"] },
  allowed: [],
};

describe("E8.16: no command leaks a canary, through the CLI or the TUI", () => {
  const names = REGISTRY.map((s) => s.name);

  it("every command has a probe or a listed exemption, and no entry is stale", () => {
    expect(coverage(names, PROBES, EXEMPT)).toEqual({ unprobed: [], stale: [] });
    expect(coverage([...names, "new"], PROBES, EXEMPT).unprobed).toEqual(["new"]);
    expect(coverage(names, PROBES, { ...EXEMPT, read: "x" }).stale).toEqual(["read"]);
    expect(coverage(names, PROBES, { ...EXEMPT, gone: "x" }).stale).toEqual(["gone"]);
  });

  it("the exemptions that can be run still hold: they show no canary from the canary workspace", async () => {
    const dir = await fresh();
    // A harness memory file with a canary's content, which discover must count and never show.
    writeFileSync(join(dir, "CLAUDE.md"), `${contentOf(byLabel("dana-person"))}\n`);
    for (const [name, { holds }] of Object.entries(EXEMPT)) {
      if (holds === undefined) continue;
      const { io: plain, out } = io(dir, { n: 0 });
      const code = await run(holds, plain);
      expect(code, `${name}: ${out.err}`).toBeLessThan(4);
      expect(`${out.out}\n${out.err}`.length, name).toBeGreaterThan(1);
      expect(leaksIn(`${out.out}\n${out.err}`, NOBODY), name).toEqual([]);
    }
  });

  for (const probe of PROBE_ACTORS)
    for (const surface of ["cli", "tui"] as const)
      it(`${probe.name} (${probe.actor.id}) through the ${surface}`, async () => {
        expect((await probeAll(probe, surface)).leaks).toEqual([]);
      });

  for (const surface of ["cli", "tui"] as const)
    it(`the positive control through the ${surface}: every command that shows items or events shows a member of team:x the team's canaries`, async () => {
      const { leaks, outs } = await probeAll(CONTROL, surface);
      expect(leaks).toEqual([]);
      const found = new Set<string>();
      for (const name of ["read", "read --item", "events", "export"]) {
        // By nonce or, where a command prints ids only (the events' plain lines), by id.
        const text = (outs.get(name) ?? []).join("\n");
        const shown = CANARIES.filter((c) => text.includes(c.nonce) || text.includes(c.id)).map(
          (c) => c.label,
        );
        expect(shown, name).toEqual(expect.arrayContaining(["lee-team"]));
        // Recorded by nonce only: a by-id command echoes the ids it was asked.
        for (const l of noncesIn(text)) found.add(l);
      }
      expect(noncesIn((outs.get("read") ?? []).join("\n"))).toEqual(
        expect.arrayContaining(["dana-team", "fred-team", "lee-team"]),
      );
      controls.push({ surface, found: [...found].sort() });
    });

  it("the TUI's screen after a read, as drawn to its last page, shows each actor what the CLI's read shows it", async () => {
    for (const probe of [...PROBE_ACTORS, CONTROL]) {
      const dir = await fresh();
      // What the CLI's read shows this actor, plain and as JSON.
      const readIds = { n: 0 };
      const cliRead = async (json: boolean) => {
        const { io: plain, out } = io(dir, readIds);
        await run(
          withWorkspace(["read", "canary", ...as(probe.actor), ...(json ? ["--json"] : [])]),
          plain,
        );
        return noncesIn(out.out);
      };
      const expected = { plain: await cliRead(false), json: await cliRead(true) };
      const h = await startHarness({
        cwd: dir,
        home: dir,
        given: { ...WS, as: probe.actor.id, member: [...probe.actor.memberships] },
      });
      await h.press("r");
      await h.type("canary");
      await h.press(CTRL_S, "y");
      // Every page, until two in a row are the same (the end); 60 without that fails.
      const pages = async () => {
        let all = "";
        let last = "";
        for (let i = 0; i < 60; i++) {
          const page = await h.text();
          if (page === last) return all;
          all += `${page}\n`;
          last = page;
          await h.press(PGDN);
        }
        throw new Error(`${probe.name}: no last page within 60`);
      };
      const plain = await pages();
      await h.press("J");
      const json = await pages();
      await h.quit();
      const leaked = leaksIn(`${plain}\n${json}`, probe);
      records.push({ surface: "tui", probe: "screen", actor: probe.name, leaked });
      expect(leaked, probe.name).toEqual([]);
      expect(noncesIn(plain), `${probe.name}: the plain view`).toEqual(expected.plain);
      expect(noncesIn(json), `${probe.name}: the JSON view`).toEqual(expected.json);
      if (probe === CONTROL) expect(expected.json.length).toBeGreaterThan(0);
    }
  });

  // Card E2.17 (review finding 4): a hidden id and a never-held one answer alike through
  // explain --absent, plain and --json, on the CLI and the TUI's runner.
  it("explain --absent: a denied id and a never-held id answer alike, through the CLI and the TUI", async () => {
    const differs: string[] = [];
    for (const probe of PROBE_ACTORS)
      for (const surface of ["cli", "tui"] as const) {
        const dir = await fresh();
        const ask = async (id: string, json: boolean) => {
          const argv = withWorkspace([
            ...["explain", "--absent", id, "canary"],
            ...as(probe.actor),
            ...(json ? ["--json"] : []),
          ]);
          const { io: plain, out } = io(dir, { n: 0 });
          const r =
            surface === "tui"
              ? await runCommand(argv, plain)
              : { code: await run(argv, plain), ...out };
          return `${r.code}
${r.out}
${r.err}`.replaceAll(id, "<asked>");
        };
        for (const json of [false, true]) {
          const missing = await ask(MISSING_ID, json);
          expect(missing, `${surface} ${probe.name}`).toContain(
            json ? '"answered": false' : ": refused",
          );
          for (const c of CANARIES.filter((x) => !probe.allowed.includes(x.label))) {
            const denied = await ask(c.id, json);
            const key = `explain --absent${json ? " --json" : ""} ${probe.name} ${c.label}`;
            oracles.push({ surface, probe: key, alike: denied === missing });
            if (denied !== missing) differs.push(`${surface} ${key}: ${denied} | ${missing}`);
          }
        }
      }
    expect(differs).toEqual([]);
  });

  it("writes its probe records when ENGRAM_LEAKAGE_OUT names a folder", () => {
    recordProbes({ suite: "cli", probes: records, oracles, parity, controls });
    expect(records.length).toBeGreaterThan(0);
  });
});
