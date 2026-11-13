// Acceptance test for card PX3: `pi install` of this package into a fresh
// project, then pi in RPC mode lists the Engram commands (`get_commands`) and
// the Engram tools. Everything runs on the local path: no npm, no network
// (PI_OFFLINE=1), and nothing reads or writes the user's pi or Engram config
// (the agent directory, home and the Engram log are temporary).
//
// RPC mode has no command that lists tools, so the test loads a probe
// extension for the one process (`-e`, temporary scope) whose `/probe-tools`
// command reports `pi.getAllTools()` as a notify event on stdout.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
// The pinned pi (docs/deps.md) this package's devDependencies link; its
// exports are ESM only and do not expose cli.js, so the path is the link's.
const piCli = join(
  packageRoot,
  "node_modules",
  "@earendil-works",
  "pi-coding-agent",
  "dist",
  "cli.js",
);
const probe = join(here, "probe-tools.ts");

const ENGRAM_TOOLS = ["memory_write", "memory_read", "memory_explain", "memory_simulate"];

interface RpcLine {
  type: string;
  id?: string;
  command?: string;
  success?: boolean;
  error?: string;
  method?: string;
  message?: string;
  data?: { commands: { name: string; source: string; sourceInfo?: { origin?: string } }[] };
}

let base: string;
let project: string;
let env: NodeJS.ProcessEnv;
let pi: ChildProcess | undefined;
const lines: RpcLine[] = [];
const waiters: { match: (l: RpcLine) => boolean; done: (l: RpcLine) => void }[] = [];

function next(match: (l: RpcLine) => boolean, ms = 60_000): Promise<RpcLine> {
  const seen = lines.find(match);
  if (seen) return Promise.resolve(seen);
  return new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error(`no matching RPC line in ${ms} ms`)), ms);
    waiters.push({
      match,
      done: (l) => {
        clearTimeout(timer);
        done(l);
      },
    });
  });
}

function send(command: Record<string, unknown>): void {
  pi?.stdin?.write(`${JSON.stringify(command)}\n`);
}

beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), "engram-px3-"));
  project = join(base, "project");
  const home = join(base, "home");
  mkdirSync(project);
  mkdirSync(home);
  env = {
    ...process.env,
    PI_CODING_AGENT_DIR: join(base, "agent"),
    PI_OFFLINE: "1",
    HOME: home,
    USERPROFILE: home,
    ENGRAM_DB_URL: join(base, "engram.db"),
    ENGRAM_OFFLINE: "1",
  };

  // --approve: a fresh temp project still needs a trust decision when an
  // ancestor folder holds protected resources (an `.agents/skills` under the
  // user's home, say), and install and RPC mode cannot prompt for one.
  const install = spawnSync(
    process.execPath,
    [piCli, "install", packageRoot, "--local", "--approve"],
    {
      cwd: project,
      env,
      encoding: "utf8",
    },
  );
  expect(install.status, `pi install failed:\n${install.stdout}\n${install.stderr}`).toBe(0);

  pi = spawn(process.execPath, [piCli, "--mode", "rpc", "-a", "--no-session", "-e", probe], {
    cwd: project,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let buffer = "";
  pi.stdout?.setEncoding("utf8");
  pi.stdout?.on("data", (chunk: string) => {
    buffer += chunk;
    let at = buffer.indexOf("\n");
    while (at >= 0) {
      const text = buffer.slice(0, at).trim();
      buffer = buffer.slice(at + 1);
      at = buffer.indexOf("\n");
      if (!text.startsWith("{")) continue;
      const line = JSON.parse(text) as RpcLine;
      lines.push(line);
      for (const w of waiters.splice(0)) {
        if (w.match(line)) w.done(line);
        else waiters.push(w);
      }
    }
  });
}, 120_000);

afterAll(async () => {
  // Windows keeps the temp folder locked until pi has exited.
  if (pi && pi.exitCode === null) {
    const exited = new Promise((done) => pi?.once("exit", done));
    pi.kill();
    await exited;
  }
  rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

describe("pi install of the Engram pi package in a fresh project", () => {
  it("declares the package in the project's .pi/settings.json", () => {
    const settings = JSON.parse(readFileSync(join(project, ".pi", "settings.json"), "utf8")) as {
      packages?: (string | { source: string })[];
    };
    const sources = (settings.packages ?? []).map((p) => (typeof p === "string" ? p : p.source));
    // A relative source resolves from the settings file's folder (pi docs/packages.md).
    expect(sources.map((s) => resolve(project, ".pi", s))).toContain(packageRoot);
  });

  it("lists the /engram prompt and the engram skill from the package (RPC get_commands)", async () => {
    send({ id: "commands", type: "get_commands" });
    const reply = await next((l) => l.type === "response" && l.id === "commands");
    expect(reply.success, reply.error).toBe(true);
    const fromPackage = (reply.data?.commands ?? [])
      .filter((c) => c.sourceInfo?.origin === "package")
      .map((c) => `${c.source}:${c.name}`);
    expect(fromPackage).toEqual(expect.arrayContaining(["prompt:engram", "skill:skill:engram"]));
  }, 90_000);

  it("registers the Engram memory tools from the package's extension", async () => {
    send({ id: "probe", type: "prompt", message: "/probe-tools" });
    const note = await next(
      (l) =>
        l.type === "extension_ui_request" &&
        l.method === "notify" &&
        /^tools:/.test(l.message ?? ""),
    );
    const tools = (note.message ?? "").slice("tools:".length).split(",");
    expect(tools).toEqual(expect.arrayContaining(ENGRAM_TOOLS));
  }, 90_000);
});
