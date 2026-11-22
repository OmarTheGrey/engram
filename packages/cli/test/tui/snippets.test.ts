// The hook and MCP snippets and their Try it (card E8.15d, docs/design/tui.md
// 8.14, 8.15 and 13): the configuration is the tested fixtures' shape
// (`"matcher": "*"`, a command and an args list), the command is `engram`
// only when the PATH's engram is this CLI and, on Windows, an .exe, else
// node and the absolute main.ts with the reason said; store roots are
// absolute; Try it spawns exactly the copied command as a child process on a
// scratch :memory: log, reaches no server, lists each replacement, shows each
// sample's exit code, and shows a command that does not start as a failure.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { isAbsolute, join, resolve } from "node:path";
import { allEvents, openSqlite } from "@engram/core";
import { afterAll, describe, expect, it } from "vitest";
import {
  codexToml,
  findOnPath,
  type Host,
  hookSamples,
  hookSettings,
  mcpJson,
  resolveLaunch,
  scratchLaunch,
  thisHost,
  tryHook,
  tryMcp,
} from "../../src/tui/snippets.ts";
import { cli, FIXTURE as FIXTURE_STORE, REPO, tempDir } from "../helpers.ts";
import { startHarness } from "./harness.ts";

const MAIN = join(REPO, "packages/cli/src/main.ts");
const FIXTURE = join(REPO, "fixtures/harness/claude-code");
const PATHEXT = ".COM;.EXE;.BAT;.CMD;.VBS;.JS;.PS1";
/** Claude Code's project placeholder, as the fixture writes it (a literal, not a template). */
const PROJECT_DIR = ["$", "{CLAUDE_PROJECT_DIR}"].join("");

/** The child's environment: the real one (PATH, SystemRoot), never naming a log or a server. */
function childEnv(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  for (const k of Object.keys(env))
    if (k.startsWith("ENGRAM_") || k === "CLAUDE_PROJECT_DIR") delete env[k];
  return { ...env, ...extra };
}

/** A server that answers 500 to everything and counts what reached it. */
async function countingServer() {
  let count = 0;
  const server = createServer((_req, res) => {
    count++;
    res.statusCode = 500;
    res.end("{}");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    count: () => count,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

/** A project folder with the fixture store as its memory/ folder, as the harness fixture has it. */
async function projectWithMemory() {
  const project = await tempDir();
  const memory = join(project, "memory");
  await cp(FIXTURE_STORE, memory, { recursive: true });
  return { project, memory };
}

const closers: (() => Promise<void>)[] = [];
afterAll(async () => {
  for (const c of closers) await c();
});

describe("the command a snippet names (8.14)", () => {
  it("an engram.cmd on the PATH gives the node.exe and absolute main.ts form, saying why", async () => {
    const dir = await tempDir();
    writeFileSync(join(dir, "engram.cmd"), `@node "${MAIN}" %*\r\n`);
    const host: Host = {
      platform: "win32",
      env: { PATH: dir, PATHEXT },
      execPath: "C:\\Program Files\\nodejs\\node.exe",
      main: MAIN,
    };
    expect(findOnPath("engram", host)).toBe(join(dir, "engram.cmd"));
    const launch = resolveLaunch(host);
    expect(launch.command).toBe("C:\\Program Files\\nodejs\\node.exe");
    expect(launch.prefix).toEqual([MAIN]);
    expect(launch.note).toContain(".cmd shim");
  });

  it("an engram that is not on the PATH gives the absolute form and the warning", () => {
    const launch = resolveLaunch({
      platform: "win32",
      env: { PATH: "", PATHEXT },
      execPath: "C:\\node\\node.exe",
      main: MAIN,
    });
    expect([launch.command, ...launch.prefix]).toEqual(["C:\\node\\node.exe", MAIN]);
    expect(launch.note).toBe(
      "engram is not on your PATH; the snippet uses the full path of this CLI.",
    );
  });

  it("on Windows only an engram.exe that is this CLI is used by name", async () => {
    const dir = await tempDir();
    const exe = join(dir, "engram.exe");
    writeFileSync(exe, "MZ");
    const host = (execPath: string): Host => ({
      platform: "win32",
      env: { Path: dir, PATHEXT },
      execPath,
      main: MAIN,
    });
    expect(resolveLaunch(host(exe))).toEqual({ command: "engram", prefix: [], note: undefined });
    const other = resolveLaunch(host("C:\\node\\node.exe"));
    expect(other.command).toBe("C:\\node\\node.exe");
    expect(other.note).toContain("is not this CLI");
  });

  it("on a POSIX system a PATH engram that runs this main.ts is used by name", async () => {
    const dir = await tempDir();
    writeFileSync(join(dir, "engram"), `#!/bin/sh\nexec node "${MAIN}" "$@"\n`);
    const launch = resolveLaunch({
      platform: "linux",
      env: { PATH: dir },
      execPath: "/usr/bin/node",
      main: MAIN,
    });
    expect(launch).toEqual({ command: "engram", prefix: [], note: undefined });
  });
});

describe("the snippets' shape (8.14, 8.15)", () => {
  const fixtureArgs = [
    "hook",
    "claude-code",
    "--root",
    `${PROJECT_DIR}/memory`,
    "--as",
    "person:dana",
  ];

  it("the Claude Code entry is the fixture's settings.json byte for byte, given its command and args", () => {
    const text = `${JSON.stringify(hookSettings({ command: "engram", prefix: [], note: undefined }, fixtureArgs), null, 2)}\n`;
    expect(text).toBe(readFileSync(join(FIXTURE, ".claude/settings.json"), "utf8"));
  });

  it(".mcp.json and Codex's config.toml are the fixtures' shape", () => {
    const args = JSON.parse(readFileSync(join(FIXTURE, ".mcp.json"), "utf8")).mcpServers.engram
      .args as string[];
    const launch = { command: "engram", prefix: [], note: undefined };
    expect(`${JSON.stringify(mcpJson(launch, args), null, 2)}\n`).toBe(
      readFileSync(join(FIXTURE, ".mcp.json"), "utf8"),
    );
    const toml = readFileSync(join(REPO, "fixtures/harness/codex/config.toml"), "utf8");
    const table = toml.slice(toml.indexOf("[mcp_servers.engram]"));
    expect(codexToml(launch, args)).toBe(table);
  });

  it("the absolute form puts main.ts first in args, escaped as JSON requires", () => {
    const launch = { command: "C:\\Program Files\\nodejs\\node.exe", prefix: [MAIN], note: "x" };
    const entry = hookSettings(launch, fixtureArgs).hooks.PreToolUse[0]?.hooks[0];
    expect(entry?.command).toBe("C:\\Program Files\\nodejs\\node.exe");
    expect(entry?.args).toEqual([MAIN, ...fixtureArgs]);
    expect(JSON.stringify(entry)).toContain("C:\\\\Program Files\\\\nodejs\\\\node.exe");
  });
});

describe("the hook setup screen", () => {
  it("writes store roots and protected files as absolute paths, never the project variable", async () => {
    const cwd = await tempDir();
    mkdirSync(join(cwd, "memory"));
    const h = await startHarness({ cwd, home: cwd, given: { owner: "dana", db: "engram.db" } });
    await h.press("b");
    expect(h.screen()).toBe("surface");
    await h.focusField("root");
    await h.type("memory");
    await h.press("\r");
    await h.focusField("protect");
    await h.type("secrets.txt");
    await h.press("\r");
    const screen = h.app.top() as unknown as { snippetArgs(): string[] };
    const args = screen.snippetArgs();
    const root = args[args.indexOf("--root") + 1] as string;
    const protect = args[args.indexOf("--protect") + 1] as string;
    expect(isAbsolute(root)).toBe(true);
    expect(root).toBe(resolve(cwd, "memory"));
    expect(protect).toBe(resolve(cwd, "secrets.txt"));
    expect(args.join(" ")).not.toContain("CLAUDE_PROJECT_DIR");
    expect(args[args.indexOf("--db") + 1]).toBe(resolve(cwd, "engram.db"));
    const text = await h.text();
    expect(text).toContain('"matcher": "*"');
    await h.quit();
  });
});

describe("secrets in a snippet (10.3)", () => {
  it("draws a log URL's password redacted, and copies it whole", async () => {
    const cwd = await tempDir();
    const secret = "pw-0000-SECRET";
    const db = `postgres://dana:${secret}@127.0.0.1:1/engram`;
    const h = await startHarness({
      cwd,
      home: cwd,
      given: { owner: "dana", db },
      logCheck: async () => ["ok", "a fake Postgres check"],
    });
    for (const letter of ["b", "m"]) {
      await h.press(letter);
      const text = await h.text();
      expect(text).toContain("postgres://");
      expect(text).not.toContain(secret);
      await h.press("\x1b");
    }
    await h.press("b");
    await h.focusField("button:copy");
    await h.press("\r");
    const s = await h.quit();
    expect(s.deferred.join("\n")).toContain(secret);
  });
});

describe("Try it (8.15)", () => {
  const launch = { command: process.execPath, prefix: [MAIN], note: undefined };

  it("on the generated entry blocks the store sample and lets the other through, each with exit 0", async () => {
    const { project, memory } = await projectWithMemory();
    const args = ["hook", "claude-code", "--root", memory, "--as", "person:dana"];
    const scratch = scratchLaunch(launch, args, childEnv(), project);
    const results = await tryHook(scratch, hookSamples(project, [memory]));
    expect(results.map((r) => [r.outcome, r.code])).toEqual([
      ["blocked", 0],
      ["allowed", 0],
    ]);
    expect(results[0]?.detail).toContain("permissionDecision deny");
  }, 60_000);

  it("replaces --server with --db :memory:, removes ENGRAM_SERVER_URL, lists each replacement and makes zero requests", async () => {
    const fake = await countingServer();
    closers.push(fake.close);
    const { project, memory } = await projectWithMemory();
    const args = [
      "hook",
      "claude-code",
      "--root",
      memory,
      "--as",
      "person:dana",
      "--server",
      fake.url,
    ];
    const scratch = scratchLaunch(
      launch,
      args,
      childEnv({ ENGRAM_SERVER_URL: fake.url, ENGRAM_TOKEN: "egk_secret" }),
      project,
    );
    expect(scratch.args).not.toContain("--server");
    expect(scratch.args.slice(-2)).toEqual(["--db", ":memory:"]);
    expect(scratch.env.ENGRAM_SERVER_URL).toBeUndefined();
    expect(scratch.env.ENGRAM_TOKEN).toBeUndefined();
    expect(scratch.env.ENGRAM_DB_URL).toBe(":memory:");
    expect(scratch.replaced).toEqual([
      `Try it ran with --db :memory: in place of --server ${fake.url}`,
      "Try it ran without ENGRAM_SERVER_URL, which names a server",
      "Try it ran without ENGRAM_TOKEN",
    ]);
    const results = await tryHook(scratch, hookSamples(project, [memory]));
    expect(results.map((r) => r.outcome)).toEqual(["blocked", "allowed"]);
    expect(fake.count()).toBe(0);
  }, 60_000);

  it("leaves the workspace's log as it was: its --db is replaced by :memory:", async () => {
    const dir = await tempDir();
    const db = join(dir, "engram.db");
    const { project, memory } = await projectWithMemory();
    const w = await cli([
      "write",
      "--content",
      "x",
      "--owner",
      "dana",
      "--root",
      memory,
      "--db",
      db,
    ]);
    expect(w.code).toBe(0);
    const count = () => {
      const d = openSqlite(db);
      try {
        return allEvents(d).length;
      } finally {
        d.close();
      }
    };
    const before = count();
    const args = ["hook", "claude-code", "--root", memory, "--db", db];
    const scratch = scratchLaunch(launch, args, childEnv(), project);
    expect(scratch.replaced).toContain(`Try it ran with --db :memory: in place of --db ${db}`);
    const results = await tryHook(scratch, hookSamples(project, [memory]));
    expect(results[0]?.outcome).toBe("blocked");
    expect(count()).toBe(before);
  }, 60_000);

  it("shows a command that cannot start as a failure: the hook did not run", async () => {
    const project = await tempDir();
    const missing = { command: join(project, "no-such-engram.exe"), prefix: [], note: undefined };
    const scratch = scratchLaunch(missing, ["hook", "claude-code"], childEnv(), project);
    const results = await tryHook(scratch, hookSamples(project, []));
    for (const r of results) {
      expect(r.outcome).toBe("failed");
      expect(r.detail).toContain("the hook did not run");
      expect(r.detail).toContain("Claude Code would let every tool call through");
    }
  });

  it("a hook that exits 127 is shown as one that did not run", async () => {
    const project = await tempDir();
    const scratch = scratchLaunch(
      { command: process.execPath, prefix: ["-e", "process.exitCode = 127"], note: undefined },
      ["hook", "claude-code"],
      childEnv(),
      project,
    );
    const [first] = await tryHook(scratch, hookSamples(project, []));
    expect(first?.outcome).toBe("failed");
    expect(first?.code).toBe(127);
    expect(first?.detail).toContain("the hook did not run (exit 127)");
  });

  it("the screen shows the failure loudly, with the exit code", async () => {
    const cwd = await tempDir();
    const h = await startHarness({ cwd, home: cwd, given: { owner: "dana", db: "engram.db" } });
    await h.press("b");
    const screen = h.app.top() as unknown as {
      setLaunch(l: { command: string; prefix: string[]; note: string | undefined }): void;
    };
    screen.setLaunch({ command: join(cwd, "missing-engram.exe"), prefix: [], note: undefined });
    // In the roots field t types; ctrl+s is Try it from any field.
    await h.press("\x13");
    const text = await h.text();
    expect(text).toContain("✗");
    expect(text).toContain("the hook did not run");
    expect(text).toContain("Claude Code would let every tool call through");
    await h.quit();
  }, 30_000);

  it("MCP's Try it does the handshake on a scratch log and lists the tools, reaching no server", async () => {
    const fake = await countingServer();
    closers.push(fake.close);
    const { project } = await projectWithMemory();
    const args = [
      "mcp",
      "--as",
      "agent:claude-code",
      "--member",
      "person:dana",
      "--server",
      fake.url,
    ];
    const scratch = scratchLaunch(launch, args, childEnv({ ENGRAM_SERVER_URL: fake.url }), project);
    const r = await tryMcp(scratch);
    expect(r.outcome).toBe("ok");
    expect(r.tools).toEqual(["memory_write", "memory_read", "memory_explain", "memory_simulate"]);
    expect(fake.count()).toBe(0);
  }, 60_000);

  it("MCP's Try it of a command that cannot start says the harness would get no tools", async () => {
    const project = await tempDir();
    const scratch = scratchLaunch(
      { command: join(project, "nope.exe"), prefix: [], note: undefined },
      ["mcp"],
      childEnv(),
      project,
    );
    const r = await tryMcp(scratch);
    expect(r.outcome).toBe("failed");
    expect(r.detail).toContain("the harness would get no Engram tools");
  });

  it("thisHost names this checkout's main.ts and the running node", () => {
    const host = thisHost({ PATH: "" });
    expect(host.main).toBe(MAIN);
    expect(host.execPath).toBe(process.execPath);
  });
});
