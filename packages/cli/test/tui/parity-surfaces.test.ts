// Parity of card E8.15d's commands (card E8.15, docs/design/tui.md 3.8, 6.2
// and 13): retain, lint, simulate, export, import, doctor, serve, mcp, the
// hook, the key commands and log. Card E8.15c's parity.test.ts holds its own
// commands'. Every screen here is the one the router opens for the command.
//
// For each: every flag of the command has a control whose value becomes
// exactly that flag; the command line the screen shows means what the plain
// command means; and running it from the screen issues the same client
// requests (method, path, body) through Io.transport and prints the same
// bytes as `run` given that command line, on a twin of the same workspace,
// with ids and the workspace's folder normalised; in process, and for the
// five client commands also against a server (`listen` over the twin). The
// JSON view (J) is the plain command's --json output. The commands that are
// not one client call give the same command line and the same output:
// doctor, serve, mcp (its handshake), the hook (its JSON on a sample), key
// and log.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PassThrough, Readable } from "node:stream";
import { listen, openWorkspace } from "@engram/server";
import { beforeAll, describe, expect, it } from "vitest";
import { parse } from "../../src/commands.ts";
import { type CommandSpec, command, parseOptions } from "../../src/registry.ts";
import { type Io, run } from "../../src/run.ts";
import type { RunResult } from "../../src/tui/runner.ts";
import type { FormScreen, ResultScreen } from "../../src/tui/screens/form.ts";
import type { SurfaceScreen } from "../../src/tui/screens/surface.ts";
import {
  hookSamples,
  type Launch,
  scratchLaunch,
  tryHook,
  tryMcp,
} from "../../src/tui/snippets.ts";
import { cli, FIXTURE, NOW, REPO, tempDir, testId } from "../helpers.ts";
import { type Harness, startHarness } from "./harness.ts";

const SAVE = "\x13";
const TAB = "\t";
const ENTER = "\r";
const MAIN = join(REPO, "packages/cli/src/main.ts");
const ITEM = "01930000-0000-7000-8000-00000000a001";
const WORKLOAD = join(REPO, "fixtures/workloads/e8-9-two-presets.json");

/** A seeded workspace: the fixture store in mem/, one item with a fixed id, a bundle, a key file. */
let seed: string;
let keyId: string;
beforeAll(async () => {
  seed = await tempDir();
  cpSync(FIXTURE, join(seed, "mem"), { recursive: true });
  const at = { cwd: seed };
  const db = ["--db", "engram.db"];
  const w = await cli(
    [
      "write",
      "--id",
      ITEM,
      "--content",
      "The deploy key rotates every 90 days.",
      "--owner",
      "dana",
      "--root",
      "mem",
      ...db,
    ],
    at,
  );
  expect(w.code).toBe(0);
  expect((await cli(["export", "--owner", "dana", ...db, "--out", "bundle.jsonl"], at)).code).toBe(
    0,
  );
  const k = await cli(
    [
      "key",
      "create",
      "--keys",
      "keys.json",
      "--as",
      "person:dana",
      "--source",
      "user",
      "--expires",
      "2027-01-01T00:00:00Z",
    ],
    at,
  );
  expect(k.code).toBe(0);
  keyId = /^key ([0-9a-f]{12}) /m.exec(k.out)?.[1] as string;
});

/** A copy of the seeded workspace: the TUI's, the plain command's and the --json run's are twins. */
async function twin(): Promise<string> {
  const dir = await tempDir();
  cpSync(seed, dir, { recursive: true });
  return dir;
}

/** One client request as it went out: method, path, body. */
interface Sent {
  method: string;
  path: string;
  body: string;
}
const recorder =
  (into: Sent[]): Io["transport"] =>
  (fetch) =>
  async (request) => {
    into.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body: await request.clone().text(),
    });
    return fetch(request);
  };

/** Text with the workspace's folder, every UUID and every key normalised, in order of appearance. */
function normal(text: string, dirs: readonly string[]): string {
  let out = text;
  for (const d of dirs)
    for (const form of [d, JSON.stringify(d).slice(1, -1), d.replaceAll("\\", "/")])
      out = out.split(form).join("<ws>");
  const ids = new Map<string, string>();
  out = out.replace(/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}/g, (id) => {
    if (!ids.has(id)) ids.set(id, `<id${ids.size}>`);
    return ids.get(id) as string;
  });
  return out
    .replace(/egk_[0-9a-f]{12}_[A-Za-z0-9_*-]+/g, "<key>")
    .replace(/\bkey [0-9a-f]{12}\b/g, "key <key id>")
    .replace(/\b[0-9a-f]{64}\b/g, "<hash>")
    .replace(/127\.0\.0\.1:\d+/g, "127.0.0.1:<port>");
}

/** The plain command: `run(argv)` in `cwd`, with the same clock, ids and home as the TUI. */
async function plain(
  h: Harness,
  argv: readonly string[],
  cwd: string,
  sent: Sent[] = [],
  extra: Partial<Io> = {},
) {
  let out = "";
  let err = "";
  const code = await run([...argv], {
    ...h.io,
    cwd,
    out: (s) => {
      out += s;
    },
    err: (s) => {
      err += s;
    },
    transport: recorder(sent),
    ...extra,
  });
  return { code, out, err };
}

/** The parsed meaning of a command line: its flags and positionals as the CLI's own parse gives them. */
function meaning(spec: CommandSpec, argv: readonly string[]) {
  const words = spec.name.split(" ").filter((w) => !w.startsWith("--"));
  const args = spec.allowPositionals ? argv.slice(1) : argv.slice(words.length);
  const { values, positionals } = parse([...args], parseOptions(spec), spec.allowPositionals);
  return { values: { ...values }, positionals };
}

/** The screen the TUI opens for a command, filled from a command line, and the line it shows. */
async function open(h: Harness, spec: CommandSpec, argv: readonly string[]) {
  const words = spec.name.split(" ").filter((w) => !w.startsWith("--"));
  const { values, positionals } = meaning(spec, argv);
  h.app.openCommand(spec, values as never, positionals.slice(words.length - 1));
  await h.frame();
  return h.app.top();
}

/** What the open screen would run: its command row. */
const shownArgv = (h: Harness) => [...(h.app.top().command(h.app).argv ?? [])];

/** Runs the open screen's command as a person does: ctrl+s, then the confirmation's answer. */
async function runOnScreen(h: Harness): Promise<RunResult> {
  await h.press(SAVE);
  if (h.overlay() === "confirm") {
    const typed = /Type (\S+) to go on/.exec(await h.text())?.[1];
    if (typed !== undefined) {
      await h.type(typed);
      await h.press(TAB, ENTER);
    } else await h.press("y");
  }
  const top = h.app.top();
  const result =
    top.kind === "result"
      ? (top as unknown as ResultScreen).result
      : (top as unknown as SurfaceScreen).result;
  if (result === undefined) throw new Error(`nothing ran:\n${await h.text()}`);
  return result;
}

/** A sample command line for each of this part's client commands, in a seeded workspace. */
const SAMPLES: Readonly<Record<string, readonly string[]>> = {
  retain: ["retain", "--scope", "person:dana", "--owner", "dana", "--db", "engram.db"],
  lint: ["lint", "--scope", "person:dana", "--owner", "dana", "--db", "engram.db"],
  simulate: ["simulate", "--workload", WORKLOAD, "--candidate", "strict", "--db", "engram.db"],
  export: ["export", "--owner", "dana", "--db", "engram.db", "--out", "out.jsonl"],
  import: ["import", "bundle.jsonl", "--owner", "dana", "--root", "mem", "--db", "engram.db"],
};

/** The same, against a server: the workspace is the server's, so no log or store flag. */
const SERVER_SAMPLES: Readonly<Record<string, readonly string[]>> = {
  retain: ["retain", "--scope", "person:dana", "--owner", "dana"],
  lint: ["lint", "--scope", "person:dana", "--owner", "dana"],
  simulate: ["simulate", "--workload", WORKLOAD, "--candidate", "strict"],
  export: ["export", "--owner", "dana", "--out", "out.jsonl"],
  import: ["import", "bundle.jsonl", "--owner", "dana"],
};

/** A server over the twin at `dir` (its log and store), on `port`, 0 for any, as engram serve opens one. */
async function serveAt(dir: string, port: number) {
  let n = 9000;
  const workspace = openWorkspace({
    root: join(dir, "mem"),
    owner: "dana",
    db: join(dir, "engram.db"),
    cwd: dir,
    home: dir,
    env: {},
    newId: () => testId(++n),
  });
  workspace.open();
  const server = await listen(workspace, {
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

/** The commands that are not one client call, each with its own case below. */
const NOT_CLIENT = [
  "serve",
  "mcp",
  "hook claude-code",
  "key create",
  "key list",
  "key revoke",
  "doctor",
  // Card E9.10.
  "discover",
  "log verify",
  "log checkpoint",
];

/** The hand-made screens' JSON view, by command: every one but those with none (export) or a second effect. */
const JSON_VIEW = ["retain", "lint", "simulate", "doctor", "discover", "key list", "log verify"];

/** This part's commands. */
const MINE = [...Object.keys(SAMPLES), ...NOT_CLIENT];

describe("E8.15d parity: this part's commands", () => {
  it("each opens its hand-made screen through the router, but log checkpoint, its generated form", async () => {
    const cwd = await tempDir();
    const h = await startHarness({ cwd, home: cwd, given: {} });
    for (const name of MINE) {
      h.app.openCommand(command(name) as CommandSpec);
      expect(h.screen(), name).toBe(name === "log checkpoint" ? "form" : "surface");
      h.app.pop();
    }
    await h.quit();
  });

  it("gives every flag a control whose value becomes exactly that flag", async () => {
    const cwd = await tempDir();
    const h = await startHarness({ cwd, home: cwd, given: {} });
    for (const spec of MINE.map((n) => command(n) as CommandSpec)) {
      // The screen the router opens for the command.
      h.app.openCommand(spec);
      const screen = h.app.top();
      h.app.pop();
      const form = (screen as unknown as { form: FormScreen["form"] }).form;
      // Every flag a control, but --json, which J shows (docs/design/tui.md 3.2).
      const flags = Object.keys(spec.options).filter((f) => f !== "json");
      for (const f of flags) expect(form.field(f), `${spec.name} --${f}`).toBeDefined();
      for (const f of form.fields) {
        // Typed, as a person sets it: the workspace's flags then stay as set (E8.15c's syncWorkspace).
        form.touched.add(f.id);
        if (f.boolean) form.setValue(f.id, true);
        else if (f.multiple) form.setValue(f.id, ["v1"]);
        else if (f.choices) form.setValue(f.id, f.choices[0] as string);
        else form.setValue(f.id, f.positional ? "p1" : "v1");
      }
      // The flags a choice of the screen hides are reached by choosing otherwise.
      const states: Record<string, readonly string[]> = {
        auth: ["keys", "issuer", "none"],
        transport: ["stdio", "http"],
        encryption: ["none", "recipients", "passphrase"],
        source: ["bundle", "claude"],
      };
      const own = Object.keys(states).filter((k) => k in (screen as object));
      const combos = own.reduce<Record<string, string>[]>(
        (acc, k) => acc.flatMap((c) => (states[k] as string[]).map((v) => ({ ...c, [k]: v }))),
        [{}],
      );
      const seen = new Set<string>();
      for (const server of [false, true])
        for (const combo of combos) {
          Object.assign(screen, combo);
          if (form.field("server")) form.setValue("server", server ? "http://127.0.0.1:1" : "");
          const argv =
            "argv" in screen ? (screen as SurfaceScreen).argv(h.app) : form.argv(h.app.ws);
          for (const w of argv) if (w.startsWith("--")) seen.add(w.slice(2));
          if (argv.includes("p1")) seen.add("<positional>");
        }
      for (const f of flags) expect(seen.has(f), `${spec.name} --${f} is reachable`).toBe(true);
      if (spec.positionals.length > 0)
        expect(seen.has("<positional>"), `${spec.name} positional`).toBe(true);
    }
    await h.quit();
  });
});

describe("E8.15d parity: each client command's TUI action is its plain command", () => {
  for (const [name, sample] of Object.entries(SAMPLES))
    it(`${name}: the same requests, the same bytes, the same exit code`, async () => {
      const spec = command(name) as CommandSpec;
      const [a, b, c] = [await twin(), await twin(), await twin()];
      const tuiSent: Sent[] = [];
      const h = await startHarness({ cwd: a, home: a, given: {}, transport: recorder(tuiSent) });
      await open(h, spec, sample);
      const argv = shownArgv(h);
      // The line shown means what the sample means.
      expect(meaning(spec, argv)).toEqual(meaning(spec, sample));
      const result = await runOnScreen(h);
      expect(result.argv).toEqual(argv);
      const plainSent: Sent[] = [];
      const p = await plain(h, argv, b, plainSent);
      const dirs = [a, b, c];
      expect(result.code).toBe(p.code);
      expect(normal(`${result.out}${result.err}`, dirs)).toBe(normal(`${p.out}${p.err}`, dirs));
      expect(tuiSent.length).toBeGreaterThan(0);
      expect(tuiSent.map((s) => ({ ...s, body: normal(s.body, dirs) }))).toEqual(
        plainSent.map((s) => ({ ...s, body: normal(s.body, dirs) })),
      );
      if (JSON_VIEW.includes(name)) {
        await h.press("J");
        const shown = (h.app.top() as unknown as { json?: string }).json;
        const j = await plain(h, [...argv, "--json"], c);
        expect(normal(shown ?? "", dirs)).toBe(normal(j.out, dirs));
      }
      await h.quit();
    });
});

describe("E8.15d parity: against a server", () => {
  for (const [name, sample] of Object.entries(SERVER_SAMPLES))
    it(`${name}: the same requests, the same bytes, the same exit code`, async () => {
      const spec = command(name) as CommandSpec;
      const [a, b] = [await twin(), await twin()];
      const tuiSent: Sent[] = [];
      const srv = await serveAt(a, 0);
      const h = await startHarness({
        cwd: a,
        home: a,
        given: { server: srv.url },
        transport: recorder(tuiSent),
      });
      await open(h, spec, [...sample, "--server", srv.url]);
      const argv = shownArgv(h);
      expect(argv.slice(argv.indexOf("--server"), argv.indexOf("--server") + 2)).toEqual([
        "--server",
        srv.url,
      ]);
      expect(argv).not.toContain("--db");
      const result = await runOnScreen(h);
      await h.quit();
      await srv.close();
      // The plain command against the twin's own server: a port of its own, since a client's
      // pooled connection to the first one would not survive it (normal() folds the ports).
      const twinSrv = await serveAt(b, 0);
      const plainSent: Sent[] = [];
      const p = await plain(
        h,
        argv.map((w) => (w === srv.url ? twinSrv.url : w)),
        b,
        plainSent,
      );
      await twinSrv.close();
      const dirs = [a, b];
      expect(result.code).toBe(p.code);
      expect(normal(`${result.out}${result.err}`, dirs)).toBe(normal(`${p.out}${p.err}`, dirs));
      expect(tuiSent.length).toBeGreaterThan(0);
      expect(tuiSent.map((s) => ({ ...s, body: normal(s.body, dirs) }))).toEqual(
        plainSent.map((s) => ({ ...s, body: normal(s.body, dirs) })),
      );
    });
});

describe("E8.15d parity: the commands that are not one client call", () => {
  it("doctor: the same command line and the same output, and J is doctor --json", async () => {
    const a = await twin();
    const h = await startHarness({ cwd: a, home: a, given: {} });
    const spec = command("doctor") as CommandSpec;
    await open(h, spec, ["doctor", "--db", "engram.db"]);
    const argv = shownArgv(h);
    expect(argv).toEqual(["doctor", "--db", "engram.db"]);
    const result = await runOnScreen(h);
    const p = await plain(h, argv, a);
    expect([result.code, result.out]).toEqual([p.code, p.out]);
    await h.press("J");
    const j = await plain(h, [...argv, "--json"], a);
    expect((h.app.top() as unknown as { json?: string }).json).toBe(j.out);
    await h.quit();
  });

  it("discover: the same command line and the same output, and J is discover --json (card E9.10)", async () => {
    const a = await twin();
    // The fake home: twelve harness memory files, two of them in the auto memory root.
    const home = join(REPO, "fixtures", "harness", "home");
    const given = ["--home", home, "--project", join(home, "lantern")];
    const root = join(home, ".claude", "projects", "-src-lantern", "memory");
    const h = await startHarness({ cwd: a, home: a, given: {} });
    const spec = command("discover") as CommandSpec;
    await open(h, spec, ["discover", ...given, "--root", root]);
    const argv = shownArgv(h);
    expect(argv).toEqual(["discover", ...given, "--root", root]);
    const result = await runOnScreen(h);
    const p = await plain(h, argv, a);
    expect([result.code, result.out]).toEqual([p.code, p.out]);
    await h.press("J");
    const j = await plain(h, [...argv, "--json"], a);
    expect((h.app.top() as unknown as { json?: string }).json).toBe(j.out);
    await h.quit();
  });

  for (const [name, sample] of [
    [
      "key create",
      [
        "key",
        "create",
        "--keys",
        "keys.json",
        "--as",
        "person:sam",
        "--source",
        "user",
        "--expires",
        "2027-01-01T00:00:00Z",
      ],
    ],
    ["key list", ["key", "list", "--keys", "keys.json"]],
    ["key revoke", ["key", "revoke", "<id>", "--keys", "keys.json"]],
    ["log verify", ["log", "verify", "--db", "engram.db"]],
    ["log checkpoint", ["log", "checkpoint", "--db", "engram.db"]],
  ] as const)
    it(`${name}: the same command line and the same output`, async () => {
      const spec = command(name) as CommandSpec;
      const line = sample.map((w) => (w === "<id>" ? keyId : w));
      const [a, b] = [await twin(), await twin()];
      const h = await startHarness({ cwd: a, home: a, given: {} });
      await open(h, spec, line);
      const argv = shownArgv(h);
      expect(meaning(spec, argv)).toEqual(meaning(spec, line));
      const result = await runOnScreen(h);
      const p = await plain(h, argv, b);
      expect(result.code).toBe(p.code);
      expect(normal(result.out, [a, b])).toBe(normal(p.out, [a, b]));
      await h.quit();
    });

  it("serve: the same command line, start line and stop line", async () => {
    const [a, b] = [await twin(), await twin()];
    const h = await startHarness({ cwd: a, home: a, given: {} });
    const line = ["serve", "--insecure-loopback", "--port", "0", "--db", "engram.db"];
    await open(h, command("serve") as CommandSpec, line);
    const argv = shownArgv(h);
    expect(meaning(command("serve") as CommandSpec, argv)).toEqual(
      meaning(command("serve") as CommandSpec, line),
    );
    await h.press(SAVE);
    const screen = h.app.top() as unknown as {
      running?: { out: string; url(): string | undefined };
    };
    for (let i = 0; i < 400 && screen.running?.url() === undefined; i++)
      await new Promise((r) => setTimeout(r, 25));
    await h.press(SAVE); // Stop
    const ended = (h.app.top() as unknown as { ended?: { out: string; code?: number } }).ended;
    const stop = new AbortController();
    let out = "";
    const done = run([...argv], {
      ...h.io,
      cwd: b,
      out: (s) => {
        out += s;
        if (s.includes("listening on")) stop.abort();
      },
      stop: stop.signal,
    });
    expect(await done).toBe(ended?.code);
    expect(normal(ended?.out ?? "", [a, b])).toBe(normal(out, [a, b]));
    expect(ended?.out).toContain("engram serve: stopped");
    await h.quit();
  }, 30_000);

  it("the hook: the snippet's command line is the screen's, and Try it prints what run prints", async () => {
    const a = await twin();
    const h = await startHarness({ cwd: a, home: a, given: {} });
    await open(h, command("hook claude-code") as CommandSpec, [
      "hook",
      "claude-code",
      "--root",
      "mem",
      "--as",
      "person:dana",
      "--db",
      "engram.db",
    ]);
    const screen = h.app.top() as unknown as {
      snippetArgs(): string[];
      setLaunch(l: Launch): void;
    };
    const launch: Launch = { command: process.execPath, prefix: [MAIN], note: undefined };
    screen.setLaunch(launch);
    expect(shownArgv(h)).toEqual(screen.snippetArgs());
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([k, v]) => v !== undefined && !k.startsWith("ENGRAM_")),
    ) as Record<string, string>;
    const scratch = scratchLaunch(launch, screen.snippetArgs(), env, a);
    const samples = hookSamples(a, [join(a, "mem")]);
    const tried = await tryHook(scratch, samples);
    for (const [i, s] of samples.entries()) {
      const p = await plain(h, scratch.args.slice(1), a, [], {
        env: { ...h.io.env, ...scratch.env },
        stdin: Readable.from([JSON.stringify(s.input)]),
      });
      expect(tried[i]?.code).toBe(p.code);
      expect(tried[i]?.stdout).toBe(p.out);
    }
    expect(tried.map((t) => t.outcome)).toEqual(["blocked", "allowed"]);
    await h.quit();
  }, 60_000);

  it("mcp: the snippet's command line is the screen's, and Try it's handshake answers as run's does", async () => {
    const a = await twin();
    const h = await startHarness({ cwd: a, home: a, given: {} });
    await open(h, command("mcp") as CommandSpec, [
      "mcp",
      "--as",
      "agent:claude-code",
      "--member",
      "person:dana",
      "--db",
      "engram.db",
    ]);
    const screen = h.app.top() as unknown as {
      snippetArgs(): string[];
      setLaunch(l: Launch): void;
    };
    const launch: Launch = { command: process.execPath, prefix: [MAIN], note: undefined };
    screen.setLaunch(launch);
    expect(shownArgv(h)).toEqual(screen.snippetArgs());
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([k, v]) => v !== undefined && !k.startsWith("ENGRAM_")),
    ) as Record<string, string>;
    const scratch = scratchLaunch(launch, screen.snippetArgs(), env, a);
    const child = await tryMcp(scratch);
    // The same command in process over stdio streams, the same handshake.
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stop = new AbortController();
    const lines: string[] = [];
    let buffer = "";
    stdout.on("data", (c) => {
      buffer += String(c);
      let nl = buffer.indexOf("\n");
      while (nl >= 0) {
        lines.push(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
        const last = JSON.parse(lines.at(-1) as string) as { id?: number };
        if (last.id === 1) {
          stdin.write(
            `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
          );
          stdin.write(
            `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`,
          );
        }
        if (last.id === 2) stop.abort();
      }
    });
    const done = plain(h, scratch.args.slice(1), a, [], {
      env: { ...h.io.env, ...scratch.env },
      stdin,
      stdout,
      stop: stop.signal,
    });
    stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "engram-tui-try-it", version: "0" } } })}\n`,
    );
    expect((await done).code).toBe(0);
    const tools = (
      JSON.parse(lines.find((l) => l.includes('"id":2')) as string).result.tools as {
        name: string;
      }[]
    ).map((t) => t.name);
    expect(child.tools).toEqual(tools);
    await h.quit();
  }, 60_000);
});

describe("E8.15d parity: what the screens never change", () => {
  it("a Postgres or file argument stays as typed on the command line: only the hook and MCP snippets write paths absolute", async () => {
    const a = await tempDir();
    mkdirSync(join(a, "mem"));
    writeFileSync(join(a, "x.json"), readFileSync(WORKLOAD));
    const h = await startHarness({ cwd: a, home: a, given: {} });
    await open(h, command("simulate") as CommandSpec, ["simulate", "--workload", "x.json"]);
    expect(shownArgv(h)).toEqual(["simulate", "--workload", "x.json"]);
    await h.quit();
  });
});
