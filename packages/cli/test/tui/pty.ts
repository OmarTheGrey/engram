// A real pseudoconsole for `engram tui` (card E8.15e, test support for
// `make test-e2e`): ConPTY on Windows, a Unix pty elsewhere, through
// @lydell/node-pty (a root dev dependency, docs/deps.md), with what the TUI
// writes fed into @xterm/headless so a test reads the screen back as a
// terminal shows it. The FakeTerminal of the unit layers cannot show what
// only a real console does: the process's exit, its streams after the TUI
// gives the terminal back, and stdin moving between raw mode and line mode.
// `probePty` says whether a pseudoconsole can be had here, and why not.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import xterm from "@xterm/headless";

type IPty = {
  onData(cb: (d: string) => void): void;
  onExit(cb: (e: { exitCode: number }) => void): void;
  write(d: string): void;
  kill(): void;
  readonly pid: number;
};
type PtyModule = {
  spawn(
    file: string,
    args: string[],
    o: { name: string; cols: number; rows: number; cwd: string; env: Record<string, string> },
  ): IPty;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The pty module, or why there is no pseudoconsole here: a module that does not load or a child that does not run. */
export async function probePty(): Promise<{ pty: PtyModule } | { skip: string }> {
  let pty: PtyModule;
  try {
    const m = (await import("@lydell/node-pty")) as unknown as { default?: PtyModule } & PtyModule;
    pty = m.default ?? m;
  } catch (e) {
    return { skip: `no pseudoconsole: @lydell/node-pty does not load (${(e as Error).message})` };
  }
  try {
    const p = pty.spawn(process.execPath, ["-e", "process.exit(0)"], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: { ...(process.env as Record<string, string>) },
    });
    const code = await Promise.race([
      new Promise<number>((r) => p.onExit((e) => r(e.exitCode))),
      wait(15_000).then(() => -1),
    ]);
    if (code !== 0) {
      p.kill();
      return { skip: `no pseudoconsole: a child under it did not exit 0 (${code})` };
    }
  } catch (e) {
    return { skip: `no pseudoconsole: spawning under one failed (${(e as Error).message})` };
  }
  return { pty };
}

export interface PtySession {
  /** The screen as the terminal shows it, one string a row. */
  screen(): Promise<string[]>;
  /** Waits until a row of the screen contains `text`; false when `ms` passed first. */
  find(text: string, ms?: number): Promise<boolean>;
  /** Sends keys, then lets the TUI take them. */
  keys(data: string, settle?: number): Promise<void>;
  /** The exit code, or -1 when the process had not exited within `ms` (it is then killed). */
  exit(ms?: number): Promise<number>;
  /** Every byte the process wrote. */
  raw(): string;
  /** The whole buffer, scrollback included, as text: a wrapped row joined to the one before it. */
  text(): Promise<string>;
  /** What it wrote after it last left the alternate screen: the quit summary. */
  after(): string;
  /** What the exit hook saw: uncaught exceptions and unhandled rejections, one a line. */
  uncaught(): string;
  /** Kills the TUI and every process under it, and waits for it to end (review E-6). */
  kill(): Promise<void>;
}

export interface PtyStart {
  main: string;
  args: string[];
  cwd: string;
  home: string;
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
}

/** Every session started and not yet ended: what killAll stops after a test. */
const live = new Set<PtySession>();

/** Kills every session still running, each with its process tree (review E-6: a failed expectation left them). */
export async function killAll(): Promise<void> {
  const all = [...live];
  live.clear();
  await Promise.all(all.map((s) => s.kill()));
}

/**
 * Starts `node <main> <args>` under the pseudoconsole, with HOME and
 * USERPROFILE at `home`, CI and every variable naming a log, a server or a
 * token removed, and an exit hook that records any uncaught exception in a
 * file beside the home.
 */
export function startPty(pty: PtyModule, o: PtyStart): PtySession {
  const cols = o.cols ?? 80;
  const rows = o.rows ?? 24;
  const hook = join(o.home, "..", "exit-hook.mjs");
  const log = join(o.home, "..", "uncaught.log");
  writeFileSync(log, "");
  writeFileSync(
    hook,
    [
      'import { appendFileSync } from "node:fs";',
      `const L = ${JSON.stringify(log)};`,
      'const line = (...words) => appendFileSync(L, words.join(" ") + "\\n");',
      'process.on("uncaughtExceptionMonitor", (e, origin) => line("UNCAUGHT", origin, e && e.stack));',
      'process.on("unhandledRejection", (e) => line("UNHANDLED", e && e.stack));',
      "",
    ].join("\n"),
  );
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  for (const k of ["CI", "ENGRAM_DB_URL", "ENGRAM_SERVER_URL", "ENGRAM_TOKEN", "NO_COLOR"])
    delete env[k];
  Object.assign(env, {
    HOME: o.home,
    USERPROFILE: o.home,
    TERM: "xterm-256color",
    NODE_OPTIONS: `--import ${pathToFileURL(hook).href}`,
    ...(o.env ?? {}),
  });
  const xt = new xterm.Terminal({ cols, rows, allowProposedApi: true, scrollback: 1000 });
  const p = pty.spawn(process.execPath, [o.main, ...o.args], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: o.cwd,
    env,
  });
  let raw = "";
  p.onData((d) => {
    raw += d;
    xt.write(d);
  });
  let code: number | undefined;
  const exited = new Promise<number>((r) =>
    p.onExit((e) => {
      code = e.exitCode;
      r(e.exitCode);
    }),
  );
  const screen = async () => {
    await new Promise<void>((r) => xt.write("", r));
    const b = xt.buffer.active;
    const out: string[] = [];
    for (let i = 0; i < xt.rows; i++)
      out.push(b.getLine(b.viewportY + i)?.translateToString(true) ?? "");
    return out;
  };
  const session: PtySession = {
    screen,
    async find(text, ms = 20_000) {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        if ((await screen()).some((l) => l.includes(text))) return true;
        if (code !== undefined) return false;
        await wait(100);
      }
      return false;
    },
    async keys(data, settle = 400) {
      p.write(data);
      await wait(settle);
    },
    async exit(ms = 20_000) {
      const c = await Promise.race([exited, wait(ms).then(() => -1)]);
      if (c === -1) p.kill();
      // The last bytes reach the emulator after the exit event on some systems.
      await wait(300);
      return c;
    },
    raw: () => raw,
    async text() {
      await new Promise<void>((r) => xt.write("", r));
      const b = xt.buffer.active;
      let out = "";
      for (let i = 0; i < b.length; i++) {
        const line = b.getLine(i);
        if (line === undefined) continue;
        const next = b.getLine(i + 1);
        if (i > 0 && !line.isWrapped) out += "\n";
        // A row the next one continues keeps its trailing spaces: they are the text's.
        out += line.translateToString(next?.isWrapped !== true);
      }
      return out;
    },
    after() {
      const at = raw.lastIndexOf("\x1b[?1049l");
      return at < 0 ? "" : raw.slice(at + "\x1b[?1049l".length);
    },
    async kill() {
      live.delete(session);
      if (code !== undefined) return;
      if (process.platform === "win32")
        spawnSync("taskkill", ["/PID", String(p.pid), "/T", "/F"], { stdio: "ignore" });
      else
        try {
          process.kill(-p.pid, "SIGKILL");
        } catch {
          p.kill();
        }
      await Promise.race([exited, wait(5_000)]);
    },
    uncaught: () => {
      try {
        return readFileSync(log, "utf8");
      } catch {
        return "";
      }
    },
  };
  live.add(session);
  void exited.then(() => live.delete(session));
  return session;
}
