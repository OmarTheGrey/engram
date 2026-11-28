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
import { cpSync, writeFileSync } from "node:fs";
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
  DANA,
  LEE,
  leaksIn,
  MISSING_ID,
  MISSING_READ,
  MODEL_OPS,
  MODEL_PARITY,
  NOW,
  noncesIn,
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
      for (const r of runs) {
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

  it("a model's operations: MCP and the HTTP API agree, and both match the pi extension's snapshot", async () => {
    const via = async (surface: "mcp" | "http") => {
      const dir = await fresh();
      const ids = { n: 0 };
      const ws = workspaceAt(dir, ids);
      const app = createApp(ws, { port: 7313, now: () => NOW });
      const client = createEngramClient({
        baseUrl: "http://127.0.0.1:7313",
        fetch: async (r) => app.fetch(r),
      });
      const call = await mcpAgent({
        client,
        actor: DANA,
        now: () => NOW,
        newId: () => runId(++ids.n),
      });
      const seen = new Map<string, string>();
      const out = [];
      let readId = "";
      for (const op of MODEL_OPS) {
        const before = delta(dir).length;
        const args = JSON.parse(JSON.stringify(op.args).replaceAll("{read}", readId));
        const text = await call(op.tool, args);
        readId = /read_id="([^"]+)"/.exec(text)?.[1] ?? readId;
        out.push(opRecord(op.name, text, delta(dir).slice(before) as never, seen));
      }
      ws.close();
      return { surface, out };
    };
    const mcp = await via("mcp");
    parity.push(...mcp.out.map((o) => ({ surface: "mcp", operation: o.name, same: true })));
    await expect(`${JSON.stringify(mcp.out, null, 2)}\n`).toMatchFileSnapshot(MODEL_PARITY);
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
const EXEMPT: Record<string, string> = {
  serve:
    "it serves the HTTP API, whose every route packages/server/test/leakage.test.ts probes, and this suite's parity runs the CLI against it",
  mcp: "it serves the MCP tools, each of which packages/mcp/test/leakage.test.ts probes",
  "hook claude-code":
    "it answers a hook's JSON with allow or deny and records a block; it reads no memory",
  "key create": "it writes a key file; it reads no log and no store",
  "key list": "it reads the key file only, masked",
  "key revoke": "it writes the key file only",
  doctor: "an operator's check with no actor: counts only, never content (AGENTS.md rule 12)",
  "log verify":
    "an operator's check of the hash chain on the machine holding the log, outside the read filter by design: it names links, not content",
  "log checkpoint": "an operator's checkpoint of the chain's head: a hash, no content",
  tui: "the TUI itself: each probe here runs through its runner as the surface tui, and its screen after a read is scanned below",
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

describe("E8.16: no command leaks a canary, through the CLI or the TUI", () => {
  const names = REGISTRY.map((s) => s.name);

  it("every command has a probe or a listed exemption, and no entry is stale", () => {
    expect(coverage(names, PROBES, EXEMPT)).toEqual({ unprobed: [], stale: [] });
    expect(coverage([...names, "new"], PROBES, EXEMPT).unprobed).toEqual(["new"]);
    expect(coverage(names, PROBES, { ...EXEMPT, read: "x" }).stale).toEqual(["read"]);
    expect(coverage(names, PROBES, { ...EXEMPT, gone: "x" }).stale).toEqual(["gone"]);
  });

  for (const probe of PROBE_ACTORS)
    for (const surface of ["cli", "tui"] as const)
      it(`${probe.name} (${probe.actor.id}) through the ${surface}`, async () => {
        const dir = await fresh();
        writeFileSync(join(dir, "claude.txt"), "- a probe's pasted memory\n");
        const ids = { n: 0 };
        const leaks: string[] = [];
        const named = (words: readonly string[]) => words.filter((w) => /^[0-9a-f]{8}-/.test(w));
        const all = Object.entries(PROBES).flatMap(([name, make]) =>
          make(probe.actor).map((words) => ({ name, words })),
        );
        const naming = all.filter((p) => named(p.words).length > 0);
        const plainCalls = all.filter((p) => named(p.words).length === 0);
        const asked = naming.flatMap((p) => named(p.words));
        // As over HTTP: the commands naming no id first, so none may show a
        // canary id; then each naming command, which may echo its own ids;
        // then the first again, which may echo the ids the actor's own events
        // named, never a nonce.
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
            const leaked = leaksIn(`${r.out}\n${r.err}`, probe, echo(words));
            records.push({ surface, probe: name, actor: probe.name, leaked });
            if (leaked.length > 0) leaks.push(`${argv.join(" ")}: ${leaked.join(", ")}: ${r.out}`);
          }
        expect(leaks).toEqual([]);
      });

  it("the TUI's screen after a read, as drawn, shows each probe actor no canary", async () => {
    for (const probe of [...PROBE_ACTORS, CONTROL]) {
      const dir = await fresh();
      const h = await startHarness({
        cwd: dir,
        home: dir,
        given: { ...WS, as: probe.actor.id, member: [...probe.actor.memberships] },
      });
      await h.press("r");
      await h.type("canary");
      await h.press(CTRL_S, "y");
      // Every page of the result, then of its JSON view, as drawn.
      const pages = async () => {
        let all = "";
        for (let i = 0; i < 20; i++) {
          all += `${await h.text()}\n`;
          await h.press(PGDN);
        }
        return all;
      };
      const plain = await pages();
      await h.press("J");
      const json = await pages();
      await h.quit();
      const leaked = leaksIn(`${plain}\n${json}`, probe);
      records.push({ surface: "tui", probe: "screen", actor: probe.name, leaked });
      expect(leaked, probe.name).toEqual([]);
      if (probe === CONTROL) {
        controls.push({ surface: "tui", found: noncesIn(json) });
        expect(noncesIn(json).length, json).toBeGreaterThan(0);
      }
    }
  });

  it("the positive control: through the CLI a member of team:x is shown the team's canaries", async () => {
    const dir = await fresh();
    const { io: plain, out } = io(dir, { n: 0 });
    await run(withWorkspace(["read", "canary", ...as(CONTROL.actor), "--json"]), plain);
    const found = noncesIn(out.out);
    controls.push({ surface: "cli", found });
    expect(found).toEqual(expect.arrayContaining(["dana-team", "fred-team", "lee-team"]));
    expect(leaksIn(out.out, CONTROL as ProbeActor)).toEqual([]);
  });

  it("writes its probe records when ENGRAM_LEAKAGE_OUT names a folder", () => {
    recordProbes({ suite: "cli", probes: records, oracles: [], parity, controls });
    expect(records.length).toBeGreaterThan(0);
  });
});
