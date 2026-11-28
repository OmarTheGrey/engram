// Parity of this part's commands (card E8.15c, docs/design/tui.md 3.8 and
// 13): each TUI action issues the same client requests (method, path, body)
// and prints the same bytes as its plain command, and its JSON view shows
// the bytes the plain command prints with --json. Each case runs the TUI on a
// workspace, then restores the workspace to the state before it and runs, as
// `engram <argv>`, every command line the TUI ran, in order, with the same
// clock and the same ids; requests are captured through the client
// transport (Io.transport) on both sides. In process for every command, and
// against a server (`listen` over the same workspace) for some.
import { cpSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type Listening, listen, openWorkspace } from "@engram/server";
import { describe, expect, it } from "vitest";
import { parse } from "../../src/commands.ts";
import type { Fetch } from "../../src/connect.ts";
import { type CommandSpec, command, parseOptions } from "../../src/registry.ts";
import { type Io, run } from "../../src/run.ts";
import { specOfWords } from "../../src/tui/overlays.ts";
import type { RunResult } from "../../src/tui/runner.ts";
import { FIXTURE, HOME, NOW, REPO, tempDir, testId, VALID_FROM } from "../helpers.ts";
import { type Harness, startHarness } from "./harness.ts";

const CTRL_S = "\x13";
const ITEM = "01950000-0000-7000-8000-00000000f001";
const OLD = "01950000-0000-7000-8000-00000000f011";
const NEW = "01950000-0000-7000-8000-00000000f012";

interface Sent {
  method: string;
  path: string;
  body: unknown;
}

/** A transport that records each request's method, path and JSON body. */
function recorder(into: Sent[]) {
  return (fetch: Fetch): Fetch =>
    async (request) => {
      const text = await request.clone().text();
      into.push({
        method: request.method,
        path: new URL(request.url).pathname,
        body: text === "" ? undefined : JSON.parse(text),
      });
      return fetch(request);
    };
}

/** An Io as main.ts builds one, on `cwd`, with ids from `ids` and the fixed clock. */
function io(cwd: string, ids: { n: number }, sent: Sent[], fetch?: Fetch) {
  const out = { out: "", err: "" };
  const value: Io = {
    out: (s) => {
      out.out += s;
    },
    err: (s) => {
      out.err += s;
    },
    cwd,
    home: HOME,
    now: () => NOW,
    newId: () => testId(++ids.n),
    env: {},
    nodeVersion: process.versions.node,
    repo: REPO,
    transport: recorder(sent),
    ...(fetch ? { fetch } : {}),
  };
  return { io: value, out };
}

const FLAGS = ["--owner", "dana", "--db", "engram.db", "--root", "mem"];

/** The seed: an item of dana's and a two-version chain, written as the plain commands write them. */
const SEED = [
  ["write", "--id", ITEM, "--content", "The deploy key rotates every 90 days."],
  ["write", "--id", OLD, "--content", "Tuesday.", "--valid-from", "2026-10-01T00:00:00Z"],
  [
    ...["write", "--id", NEW, "--content", "Thursday."],
    ...["--valid-from", "2026-10-15T00:00:00Z", "--file", "lineage.json"],
  ],
];

/** dana's store folder at `dir`/mem, fresh from the fixture, and the chain's lineage file. */
async function fresh(dir: string) {
  rmSync(join(dir, "mem"), { recursive: true, force: true });
  rmSync(join(dir, "engram.db"), { force: true });
  cpSync(FIXTURE, join(dir, "mem"), { recursive: true });
  await writeFile(join(dir, "lineage.json"), JSON.stringify({ lineage: [OLD] }));
}

/** Seeds the workspace at `dir` through `flags` (a log and store, or a server); the ids after it. */
async function seed(dir: string, flags: readonly string[]) {
  const ids = { n: 100 };
  for (const argv of SEED) {
    const { io: plainIo, out } = io(dir, ids, []);
    expect(await run([...argv, ...flags], plainIo), out.err).toBe(0);
  }
  return ids.n;
}

/** A server over a fresh store at `dir` with an in-memory log, on `port` (0 for any). */
async function serve(dir: string, port: number) {
  let n = 9000;
  const workspace = openWorkspace({
    root: join(dir, "mem"),
    owner: "dana",
    db: ":memory:",
    importValidFrom: VALID_FROM,
    cwd: dir,
    home: HOME,
    env: {},
    newId: () => testId(++n),
  });
  workspace.open();
  const server: Listening = await listen(workspace, {
    port,
    now: () => NOW,
    auth: { insecureLoopback: true },
  });
  return {
    url: server.url,
    port: server.port,
    close: async () => {
      await server.close();
      workspace.close();
    },
  };
}

/** One side's workspace from scratch: in process a log and store, or a server over them. */
async function side(dir: string, server: boolean, port = 0) {
  await fresh(dir);
  const srv = server ? await serve(dir, port) : undefined;
  const flags = srv ? ["--server", srv.url, "--owner", "dana"] : FLAGS;
  const ids = await seed(dir, flags);
  return { srv, ids };
}

interface Case {
  name: string;
  /** The keys of the action, from Home. */
  keys: (h: Harness) => Promise<void>;
  /** The commands the action runs, by first words, in order. */
  runs: string[];
  /** Whether to run it against a server too. */
  server?: boolean;
}

const open =
  (name: string, values: Record<string, unknown>, positionals: string[]) => async (h: Harness) => {
    h.app.openCommand(command(name) as never, values as never, positionals);
    await h.app.settled();
  };

const CASES: Case[] = [
  { name: "read", keys: (h) => h.press("r", CTRL_S, "y"), runs: ["read"], server: true },
  {
    name: "read --item and the item page",
    keys: async (h) => {
      await open("read --item", {}, [ITEM])(h);
      await h.press("y");
    },
    runs: ["read --item", "events"],
  },
  {
    name: "explain",
    keys: (h) => h.press("r", CTRL_S, "y", "e"),
    runs: ["read", "explain"],
    server: true,
  },
  {
    name: "write",
    keys: async (h) => {
      await h.press("w");
      await h.type("Parity holds.");
      await h.press(CTRL_S, "y");
    },
    runs: ["write"],
    server: true,
  },
  {
    name: "check",
    keys: async (h) => {
      await h.press("C");
      await h.type("Parity holds.");
      await h.press(CTRL_S);
    },
    runs: ["check"],
  },
  {
    name: "promote",
    keys: async (h) => {
      await open("promote", { to: "team:platform" }, [ITEM])(h);
      await h.press(CTRL_S, "y");
    },
    runs: ["promote"],
  },
  {
    name: "grants, then undo",
    keys: async (h) => {
      await open("grants", {}, [ITEM])(h);
      await h.focusField("to");
      await h.type("person:sam");
      await h.focusField("expires");
      await h.type("2026-12-01");
      await h.press(CTRL_S, "y", "u", "y");
    },
    runs: ["grants", "grants"],
    server: true,
  },
  {
    name: "grants opened with two --add, in one call",
    keys: async (h) => {
      await open("grants", { add: [GRANT_A, GRANT_B] }, [ITEM])(h);
      await h.press(CTRL_S, "y");
    },
    runs: ["grants"],
    server: true,
  },
  { name: "events", keys: (h) => h.press("e"), runs: ["events"], server: true },
  { name: "policy", keys: (h) => h.press("y"), runs: ["policy"], server: true },
  { name: "who-can-read", keys: open("who-can-read", {}, [ITEM]), runs: ["who-can-read"] },
  {
    // Card E2.17: n on the item page asks why the item is not in a read.
    name: "why not, from the item page",
    keys: async (h) => {
      await open("read --item", {}, [ITEM])(h);
      await h.press("y", "n");
    },
    runs: ["read --item", "events", "explain"],
    server: true,
  },
  {
    // n on the read screen opens it with the read's query (none here); the item is typed.
    name: "why not, from the read screen",
    keys: async (h) => {
      await h.press("r", CTRL_S, "y", "n");
      await h.type(ITEM);
      await h.press(CTRL_S);
    },
    runs: ["read", "explain"],
  },
  {
    name: "supersede, plan then accept",
    keys: async (h) => {
      await open("supersede", {}, [NEW])(h);
      await h.press(" ", CTRL_S, "y");
    },
    runs: ["supersede", "supersede", "supersede"],
  },
];

const GRANT_A = "person:sam,class=semantic,mode=read,expires=2026-12-01T00:00:00Z";
const GRANT_B = "person:eve,class=semantic,mode=read,expires=2026-12-02T00:00:00Z";

/**
 * What each case means, as the plain command lines a person would type
 * without the workspace's flags (review finding 6): the TUI's command lines,
 * parsed, must equal these with the workspace's flags added, so a flag the
 * TUI adds or drops is caught, not only replayed.
 */
const MEANS: Record<string, (ran: readonly RunResult[]) => string[][]> = {
  read: () => [["read"]],
  "read --item and the item page": () => [["read", "--item", ITEM], ["events"]],
  explain: (ran) => [["read"], ["explain", ran[1]?.argv[1] as string]],
  write: () => [["write", "--content", "Parity holds."]],
  check: () => [["check", "--content", "Parity holds."]],
  promote: () => [["promote", ITEM, "--to", "team:platform"]],
  "grants, then undo": () => [
    ["grants", ITEM, "--add", GRANT_A],
    ["grants", ITEM, "--remove", GRANT_A],
  ],
  "grants opened with two --add, in one call": () => [
    ["grants", ITEM, "--add", GRANT_A, "--add", GRANT_B],
  ],
  events: () => [["events"]],
  policy: () => [["policy"]],
  "who-can-read": () => [["who-can-read", ITEM]],
  "why not, from the read screen": () => [["read"], ["explain", "--absent", ITEM]],
  "why not, from the item page": () => [
    ["read", "--item", ITEM],
    ["events"],
    ["explain", "--absent", ITEM],
  ],
  "supersede, plan then accept": () => [
    ["supersede", NEW],
    ["supersede", NEW, "--accept", OLD],
    ["supersede", NEW],
  ],
};

/** A command line's meaning: its parsed flags and positionals, as its handler parses them. */
function meaning(argv: readonly string[]) {
  const spec = specOfWords(argv) as CommandSpec;
  const { values, positionals } = parse(
    [...argv.slice(1)],
    parseOptions(spec),
    spec.allowPositionals,
  );
  return { command: spec.name, values: { ...values }, positionals };
}

/** The workspace's flags the command takes, as the TUI's workspace writes them. */
function workspaceFlags(argv: readonly string[], flags: readonly string[]): string[] {
  const spec = specOfWords(argv) as CommandSpec;
  const out: string[] = [];
  for (let i = 0; i < flags.length; i += 2)
    if (Object.hasOwn(spec.options, (flags[i] as string).slice(2)))
      out.push(flags[i] as string, flags[i + 1] as string);
  return out;
}

/** The command name a result ran: its words, and --item for a read by id. */
const nameOf = (argv: readonly string[]) =>
  argv[0] === "read" && argv[1] === "--item" ? "read --item" : (argv[0] as string);

async function check(c: Case, server: boolean) {
  const dir = await tempDir();
  // The TUI's side.
  const tui = await side(dir, server);
  const tuiIds = { n: tui.ids };
  const given = tui.srv
    ? { owner: "dana", server: tui.srv.url }
    : { owner: "dana", db: "engram.db", root: "mem", "import-valid-from": VALID_FROM };
  const sentByTui: Sent[] = [];
  const h = await startHarness({
    cwd: dir,
    home: dir,
    given,
    newId: () => testId(++tuiIds.n),
    transport: recorder(sentByTui),
  });
  await c.keys(h);
  const results: RunResult[] = [...h.app.results];
  const last = results.at(-1) as RunResult;
  const kind = h.screen();
  // The plain and JSON views of the last result, as the screen shows them.
  const views = kind === "item" ? undefined : { plain: "", json: "" };
  if (views !== undefined) {
    if (kind !== "result") await h.press("v");
    views.plain = await h.text();
    await h.press(kind === "result" ? "J" : "v");
    if (kind !== "result") await h.press("J");
    views.json = await h.text();
  }
  await h.quit();
  await tui.srv?.close();
  expect(results.map((r) => nameOf(r.argv))).toEqual(c.runs);
  // What the TUI ran means what the action means: no flag added, none dropped (review finding 6).
  const ws = tui.srv
    ? ["--server", tui.srv.url, "--owner", "dana"]
    : ["--db", "engram.db", "--owner", "dana", "--root", "mem", "--import-valid-from", VALID_FROM];
  const means = (MEANS[c.name] as (ran: readonly RunResult[]) => string[][])(results);
  expect(results.map((r) => meaning(r.argv))).toEqual(
    means.map((m) => meaning([...m, ...workspaceFlags(m, ws)])),
  );
  // The plain side, from the same state, the same command lines in order; then again with --json.
  for (const json of [false, true]) {
    const plain = await side(dir, server, tui.srv?.port);
    expect(plain.ids).toBe(tui.ids);
    const plainIds = { n: plain.ids };
    for (const r of results) {
      const sent: Sent[] = [];
      const { io: plainIo, out } = io(dir, plainIds, sent);
      const code = await run([...r.argv, ...(json ? ["--json"] : [])], plainIo);
      if (!json) {
        expect(sent, `${r.argv.join(" ")}: the requests`).toEqual(
          r.calls.map((x) => ({ method: x.method, path: x.path, body: x.request })),
        );
        expect(code, `${r.argv.join(" ")}: the exit code`).toBe(r.code);
        expect(out.out, `${r.argv.join(" ")}: stdout`).toBe(r.out);
        expect(out.err, `${r.argv.join(" ")}: stderr`).toBe(r.err);
      } else expect(out.out, `${r.argv.join(" ")} --json`).toBe(r.other);
    }
    await plain.srv?.close();
  }
  // The TUI's own requests are its commands' requests, and no others.
  expect(sentByTui.map((x) => `${x.method} ${x.path}`)).toEqual(
    results.flatMap((r) => r.calls.map((x) => `${x.method} ${x.path}`)),
  );
  // v and J show those bytes, as drawn.
  if (views !== undefined) {
    expect(views.plain).toContain((last.out.split("\n")[0] as string).slice(0, 60));
    expect(views.json).toContain("JSON view");
    expect(views.json).toContain(((last.other ?? "").split("\n")[1] ?? "").slice(0, 60));
  }
}

describe("each TUI action is its plain command, byte for byte", () => {
  for (const c of CASES) it(`${c.name}, in process`, () => check(c, false));
  for (const c of CASES.filter((x) => x.server))
    it(`${c.name}, against a server`, () => check(c, true));
});
