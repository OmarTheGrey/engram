// The hook and MCP configuration and their Try it (card E8.15d,
// docs/design/tui.md 8.14 and 8.15). The snippets are the tested fixtures'
// shape (fixtures/harness/claude-code/.claude/settings.json, .mcp.json and
// fixtures/harness/codex/config.toml: `"matcher": "*"`, a `command` and an
// `args` list) with two differences, both so they run as pasted: the command
// is `engram` only when the PATH's engram is this CLI and, on Windows, an
// .exe (Claude Code's command-and-args form and Node's spawn without a shell
// start no .cmd or .ps1 shim, and a hook that does not start fails open),
// else this node and the absolute main.ts, with the reason; and store roots
// are absolute, never ${CLAUDE_PROJECT_DIR}, whose expansion inside `args`
// is not promised.
//
// Try it spawns exactly the copied command and arguments as a child process
// with piped stdio (never the TUI's terminal), on a scratch log, reaching no
// server: ENGRAM_DB_URL=:memory:, ENGRAM_SERVER_URL removed, a --db replaced
// by :memory:, a --server replaced by --db :memory:, and each replacement
// listed. It decides nothing: the hook's own JSON and exit code are shown.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { delimiter as hostDelimiter, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { redactSecrets } from "../setup.ts";

type Env = Readonly<Record<string, string | undefined>>;

/** What the snippet's command is resolved on: the platform, PATH, this node and this main.ts. */
export interface Host {
  platform: NodeJS.Platform;
  env: Env;
  /** The node running the TUI, process.execPath. */
  execPath: string;
  /** The absolute packages/cli/src/main.ts of this checkout. */
  main: string;
}

/** The host the TUI runs on. */
export const thisHost = (env: Env, platform: NodeJS.Platform = process.platform): Host => ({
  platform,
  env,
  execPath: process.execPath,
  main: fileURLToPath(new URL("../main.ts", import.meta.url)),
});

/** The command a harness runs: `command`, then `prefix` before the engram arguments. */
export interface Launch {
  command: string;
  prefix: string[];
  /** Why the absolute form is used, said above the snippet; undefined for `engram`. */
  note: string | undefined;
}

const pathOf = (env: Env) => env.PATH ?? env.Path ?? env.path ?? "";

/**
 * The first `name` on the PATH, as a shell finds it: each folder in order,
 * on Windows each PATHEXT extension in its order.
 */
export function findOnPath(name: string, host: Host): string | undefined {
  const win = host.platform === "win32";
  const folders = pathOf(host.env)
    .split(win ? ";" : hostDelimiter)
    .filter((d) => d !== "");
  const exts = win
    ? (host.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter((e) => e !== "")
    : [""];
  for (const folder of folders)
    for (const ext of exts) {
      const candidate = join(folder.replace(/^"|"$/g, ""), `${name}${ext.toLowerCase()}`);
      try {
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        // not here
      }
    }
  return undefined;
}

const real = (p: string) => {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
};
const same = (a: string, b: string, win: boolean) =>
  win ? real(a).toLowerCase() === real(b).toLowerCase() : real(a) === real(b);

/** Whether a POSIX PATH engram runs this main.ts: it is that file, or a small script naming it. */
function runsThisMain(found: string, host: Host): boolean {
  if (same(found, host.main, false)) return true;
  try {
    if (statSync(found).size > 65_536) return false;
    return readFileSync(found, "utf8").includes(host.main);
  } catch {
    return false;
  }
}

/** The command the snippets name (8.14): `engram`, or this node and the absolute main.ts. */
export function resolveLaunch(host: Host): Launch {
  const absolute = (note: string): Launch => ({
    command: host.execPath,
    prefix: [host.main],
    note,
  });
  const found = findOnPath("engram", host);
  if (found === undefined)
    return absolute("engram is not on your PATH; the snippet uses the full path of this CLI.");
  if (host.platform === "win32") {
    const ext = found.slice(found.lastIndexOf(".")).toLowerCase();
    if (ext !== ".exe")
      return absolute(
        `engram on your PATH is a ${ext} shim, which this form cannot start on Windows; the snippet uses the full path of this CLI.`,
      );
    if (!same(found, host.execPath, true))
      return absolute(
        `engram on your PATH (${found}) is not this CLI; the snippet uses the full path of this one.`,
      );
    return { command: "engram", prefix: [], note: undefined };
  }
  if (!runsThisMain(found, host))
    return absolute(
      `engram on your PATH (${found}) is not this CLI; the snippet uses the full path of this one.`,
    );
  return { command: "engram", prefix: [], note: undefined };
}

/** The flags whose values are paths the hook or server resolves, written absolute. */
const PATH_FLAGS = new Set(["root", "protect", "db", "keys", "subjects", "export-jsonl"]);

/** Whether a --db value is a SQLite path (not :memory: or a URL). */
const isFilePath = (v: string) => v !== ":memory:" && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v);

/**
 * `argv` with every path flag's value absolute against `base` (8.15): a root
 * the harness resolves elsewhere would protect nothing.
 */
export function absolutePaths(argv: readonly string[], base: string): string[] {
  const out = [...argv];
  for (let i = 0; i < out.length - 1; i++) {
    const flag = out[i] as string;
    if (!flag.startsWith("--") || !PATH_FLAGS.has(flag.slice(2))) continue;
    const v = out[i + 1] as string;
    if (flag === "--db" && !isFilePath(v)) continue;
    if (!isAbsolute(v)) out[i + 1] = resolve(base, v);
    i++;
  }
  return out;
}

/** The hook's command and args, in the fixture's shape. */
export const hookCommand = (launch: Launch, argv: readonly string[]) => ({
  type: "command" as const,
  command: launch.command,
  args: [...launch.prefix, ...argv],
});

/** `.claude/settings.json` holding the PreToolUse entry, exactly as the fixture holds it. */
export const hookSettings = (launch: Launch, argv: readonly string[]) => ({
  hooks: {
    PreToolUse: [{ matcher: "*", hooks: [hookCommand(launch, argv)] }],
  },
});

/** `.mcp.json` for Claude Code, in the fixture's shape. */
export const mcpJson = (launch: Launch, argv: readonly string[]) => ({
  mcpServers: { engram: { command: launch.command, args: [...launch.prefix, ...argv] } },
});

/** Codex's `[mcp_servers.engram]` table, in the fixture's shape (TOML strings as JSON writes them). */
export function codexToml(launch: Launch, argv: readonly string[]): string {
  const args = [...launch.prefix, ...argv].map((a) => JSON.stringify(a)).join(", ");
  return `[mcp_servers.engram]\ncommand = ${JSON.stringify(launch.command)}\nargs = [${args}]\n`;
}

/** The scratch child Try it spawns: the copied command with each replacement listed. */
export interface Scratch {
  command: string;
  /** The arguments after the command: the launch's prefix, then the engram arguments. */
  args: string[];
  env: Record<string, string>;
  cwd: string;
  /** One line per replacement, said on screen. */
  replaced: string[];
}

const SCRATCH = ":memory:";
/** Variables that would reach a server or a collector, or name a log; Try it removes them. */
const REMOVED_ENV = [
  ["ENGRAM_SERVER_URL", "Try it ran without ENGRAM_SERVER_URL, which names a server"],
  ["ENGRAM_TOKEN", "Try it ran without ENGRAM_TOKEN"],
  ["ENGRAM_OTLP_URL", "Try it ran without ENGRAM_OTLP_URL, so no decision leaves the machine"],
  ["ENGRAM_EXPORT_JSONL", "Try it ran without ENGRAM_EXPORT_JSONL"],
] as const;

const shownUrl = (v: string) => (v.includes("://") ? redactSecrets(v, v) : v);

/**
 * The command and arguments of the snippet, on a scratch log that reaches
 * no server: --db replaced by :memory:, --server by --db :memory:, the
 * decision export flags removed; ENGRAM_DB_URL=:memory: and the server,
 * token and export variables removed from the environment;
 * CLAUDE_PROJECT_DIR set to the project.
 */
export function scratchLaunch(
  launch: Launch,
  argv: readonly string[],
  env: Env,
  project: string,
): Scratch {
  const replaced: string[] = [];
  const out: string[] = [];
  let db = false;
  for (let i = 0; i < argv.length; i++) {
    const word = argv[i] as string;
    const eq = word.indexOf("=");
    const flag = word.startsWith("--") && eq > 0 ? word.slice(0, eq) : word;
    const inline = word.startsWith("--") && eq > 0 ? word.slice(eq + 1) : undefined;
    const value = inline ?? (argv[i + 1] as string | undefined);
    const step = inline === undefined ? 2 : 1;
    if (flag === "--db" || flag === "--server") {
      if (value !== SCRATCH || flag === "--server")
        replaced.push(
          `Try it ran with --db ${SCRATCH} in place of ${flag} ${shownUrl(value ?? "")}`,
        );
      if (!db) out.push("--db", SCRATCH);
      db = true;
      i += step - 1;
      continue;
    }
    if (flag === "--otlp" || flag === "--export-jsonl") {
      replaced.push(`Try it ran without ${flag} ${shownUrl(value ?? "")}`);
      i += step - 1;
      continue;
    }
    out.push(word);
  }
  const child: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined) child[k] = v;
  for (const [name, line] of REMOVED_ENV)
    if (child[name] !== undefined) {
      delete child[name];
      replaced.push(line);
    }
  if (child.ENGRAM_DB_URL !== undefined && child.ENGRAM_DB_URL !== SCRATCH)
    replaced.push(`Try it ran with ENGRAM_DB_URL=${SCRATCH} in place of the log it names`);
  child.ENGRAM_DB_URL = SCRATCH;
  child.CLAUDE_PROJECT_DIR = project;
  return {
    command: launch.command,
    args: [...launch.prefix, ...out],
    env: child,
    cwd: project,
    replaced,
  };
}

/** A PreToolUse input Try it sends, and what the hook should do with it. */
export interface Sample {
  label: string;
  input: Record<string, unknown>;
  expect: "deny" | "nothing";
}

/**
 * The two samples of 8.15: a Read inside the first store root (or, with no
 * root, a store's own command), which the hook should deny; and a Read of a
 * file that touches no store, which it should let through.
 */
export function hookSamples(project: string, roots: readonly string[]): Sample[] {
  const root = roots[0];
  let inside: Record<string, unknown>;
  let label: string;
  if (root === undefined) {
    inside = { tool_name: "Bash", tool_input: { command: "mem0 add x" } };
    label = "Bash mem0 add x";
  } else {
    const file = join(resolve(project, root), "user_role.md");
    inside = { tool_name: "Read", tool_input: { file_path: file } };
    label = `Read ${file}`;
  }
  const readme = join(project, "README.md");
  return [
    { label, input: { hook_event_name: "PreToolUse", ...inside, cwd: project }, expect: "deny" },
    {
      label: `Read ${readme}`,
      input: {
        hook_event_name: "PreToolUse",
        tool_name: "Read",
        tool_input: { file_path: readme },
        cwd: project,
      },
      expect: "nothing",
    },
  ];
}

/** What one spawned child did. */
interface Spawned {
  started: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  error: string | undefined;
}

/** Runs the scratch child once with `input` on stdin, killed after `timeoutMs`. */
function spawnOnce(s: Scratch, input: string, timeoutMs: number): Promise<Spawned> {
  return new Promise((done) => {
    let stdout = "";
    let stderr = "";
    let error: string | undefined;
    let started = false;
    const child = spawn(s.command, s.args, {
      cwd: s.cwd,
      env: s.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on("spawn", () => {
      started = true;
    });
    let finished = false;
    const finish = (code: number | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      done({ started, code, stdout, stderr, error });
    };
    child.on("error", (e) => {
      error = e.message;
      // A child that never started may emit no close (Node's docs): finish here.
      if (!started) setImmediate(() => finish(null));
    });
    child.stdout?.on("data", (c) => {
      stdout += String(c);
    });
    child.stderr?.on("data", (c) => {
      stderr += String(c);
    });
    child.stdin?.on("error", () => undefined);
    child.on("close", (code) => finish(code));
    child.stdin?.end(input);
  });
}

export interface SampleResult {
  label: string;
  /** The child's exit code; null when it did not start or was killed. */
  code: number | null;
  /** blocked: deny printed on exit 0; allowed: nothing printed on exit 0; failed: anything else. */
  outcome: "blocked" | "allowed" | "failed";
  /** Whether that was what the sample expected. */
  expected: boolean;
  /** In words, for the screen. */
  detail: string;
  /** What the hook printed on stdout, verbatim (the parity test compares it with the plain run's). */
  stdout: string;
}

const DID_NOT_RUN = (code: string) =>
  `the hook did not run (${code}). Claude Code would let every tool call through. Fix the command before pasting it.`;

/** What a hook's run means to Claude Code, from its exit code and its stdout only. */
function judgeHook(sample: Sample, r: Spawned): SampleResult {
  const base = { label: sample.label, code: r.code, stdout: r.stdout };
  if (!r.started || r.error !== undefined)
    return {
      ...base,
      outcome: "failed",
      expected: false,
      detail: DID_NOT_RUN(r.error ?? "it did not start"),
    };
  if (r.code !== 0) {
    const detail =
      r.code === 2
        ? `exit 2: Claude Code would block every tool call and show this hook's stderr: ${r.stderr.trim().split("\n")[0] ?? ""}`
        : DID_NOT_RUN(r.code === null ? "it was stopped" : `exit ${r.code}`);
    return { ...base, outcome: "failed", expected: false, detail };
  }
  const out = r.stdout.trim();
  if (out === "")
    return {
      ...base,
      outcome: "allowed",
      expected: sample.expect === "nothing",
      detail: "exit 0, allowed: the hook printed nothing",
    };
  let decision: string | undefined;
  let reason = "";
  try {
    const parsed = JSON.parse(out) as {
      hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string };
    };
    decision = parsed.hookSpecificOutput?.permissionDecision;
    reason = parsed.hookSpecificOutput?.permissionDecisionReason ?? "";
  } catch {
    decision = undefined;
  }
  if (decision === undefined)
    return {
      ...base,
      outcome: "failed",
      expected: false,
      detail: "exit 0, but its output is not the JSON Claude Code reads",
    };
  return {
    ...base,
    outcome: "blocked",
    expected: sample.expect === "deny",
    detail: `exit 0, blocked: permissionDecision ${decision}${reason === "" ? "" : `: ${reason}`}`,
  };
}

/** Runs the scratch hook once per sample (8.15), each input on stdin. */
export async function tryHook(
  s: Scratch,
  samples: readonly Sample[],
  timeoutMs = 45_000,
): Promise<SampleResult[]> {
  const out: SampleResult[] = [];
  for (const sample of samples)
    out.push(judgeHook(sample, await spawnOnce(s, JSON.stringify(sample.input), timeoutMs)));
  return out;
}

export interface McpResult {
  outcome: "ok" | "failed";
  /** The tools the server listed, in its order. */
  tools: string[];
  /** The server's name and version from the handshake. */
  server: string | undefined;
  detail: string;
}

/** The MCP handshake Try it speaks (initialize, initialized, tools/list), as layer 6 does. */
const HANDSHAKE = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "engram-tui-try-it", version: "0" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
];

/**
 * Starts the scratch MCP server over stdio, speaks the handshake, lists its
 * tools and stops it (8.14). A child that does not start, or ends before
 * the handshake, is a failure in words.
 */
export function tryMcp(s: Scratch, timeoutMs = 45_000): Promise<McpResult> {
  return new Promise((done) => {
    let buffer = "";
    let stderr = "";
    let error: string | undefined;
    let started = false;
    let server: string | undefined;
    let tools: string[] | undefined;
    const child = spawn(s.command, s.args, {
      cwd: s.cwd,
      env: s.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    const send = (m: object) => child.stdin?.write(`${JSON.stringify(m)}\n`);
    child.on("spawn", () => {
      started = true;
      send(HANDSHAKE[0] as object);
    });
    let finished = false;
    child.on("error", (e) => {
      error = e.message;
      if (!started) setImmediate(() => close(null));
    });
    child.stdin?.on("error", () => undefined);
    child.stderr?.on("data", (c) => {
      stderr += String(c);
    });
    child.stdout?.on("data", (c) => {
      buffer += String(c);
      let nl = buffer.indexOf("\n");
      while (nl >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
        if (line === "") continue;
        let m: { id?: number; result?: Record<string, unknown> };
        try {
          m = JSON.parse(line);
        } catch {
          continue;
        }
        if (m.id === 1 && m.result !== undefined) {
          const info = m.result.serverInfo as { name?: string; version?: string } | undefined;
          server = info === undefined ? undefined : `${info.name} ${info.version}`;
          send(HANDSHAKE[1] as object);
          send(HANDSHAKE[2] as object);
        } else if (m.id === 2 && m.result !== undefined) {
          tools = ((m.result.tools as { name: string }[] | undefined) ?? []).map((t) => t.name);
          child.stdin?.end();
          child.kill();
        }
      }
    });
    const close = (code: number | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (tools !== undefined)
        return done({
          outcome: "ok",
          tools,
          server,
          detail: `handshake ok; tools ${tools.join(", ")}; stopped`,
        });
      const why = !started
        ? `the command did not start (${error ?? "no process"})`
        : `the command ended before the handshake (exit ${code ?? "none"})${stderr.trim() === "" ? "" : `: ${stderr.trim().split("\n")[0]}`}`;
      done({
        outcome: "failed",
        tools: [],
        server,
        detail: `${why}: the harness would get no Engram tools`,
      });
    };
    child.on("close", (code) => close(code));
  });
}

/** Whether a file exists, for the screens' notes (the key file, the protected log). */
export const exists = (path: string) => existsSync(path);
