// Layer 6 (docs/conventions/testing.md), card E8.15e: `engram tui` under a
// real pseudoconsole (ConPTY on Windows, a Unix pty elsewhere), which the
// FakeTerminal of the unit layers cannot stand in for. It starts the TUI,
// renders Home, moves, runs a command and quits with the session's commands
// printed; starts Serve, goes back with esc and quits with q while the server
// runs, expecting exit 0, no uncaught error and "stopped when the TUI quit"
// in the summary (q on the turn after its key, no render after the terminal
// is given back, the summary's write guarded: card E8.15d's review); runs
// line mode on the same console; and switches from the full screen to line
// mode with L. Every run is on a scratch log, store folder and home with
// --no-saved. Skipped, with the reason printed, where no pseudoconsole can
// be had.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { killAll, type PtySession, probePty, startPty } from "../../packages/cli/test/tui/pty.ts";

const REPO = resolve(fileURLToPath(import.meta.url), "../../..");
const MAIN = join(REPO, "packages/cli/src/main.ts");
const dirs: string[] = [];
// Review E-6: a failed expectation must not leave a TUI, or Serve's port, behind, and a folder
// a dying process still holds must not hide the failure that came first.
afterEach(async () => {
  await killAll();
});
afterAll(() => {
  for (const dir of dirs)
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch (e) {
      console.warn(`tui.e2e: could not remove ${dir}: ${(e as Error).message}`);
    }
});

/** How many node processes run this CLI's tui on a scratch folder (review E-8: no grandchild). */
function tuiProcesses(dir: string): number {
  const name = dir.split(/[\\/]/).at(-1) as string;
  const list =
    process.platform === "win32"
      ? spawnSync(
          "powershell",
          [
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object { $_.CommandLine }",
          ],
          { encoding: "utf8" },
        ).stdout
      : spawnSync("ps", ["-eo", "args"], { encoding: "utf8" }).stdout;
  return list.split(/\r?\n/).filter((l) => l.includes(" tui") && l.includes(name)).length;
}

/** A scratch workspace: its folder, the home inside it, and the flags that name it. */
function scratch() {
  const dir = mkdtempSync(join(tmpdir(), "engram-e2e-tui-"));
  dirs.push(dir);
  const home = join(dir, "home");
  mkdirSync(home);
  mkdirSync(join(dir, "mem"));
  const flags = [
    "--owner",
    "dana",
    "--db",
    join(dir, "engram.db"),
    "--root",
    join(dir, "mem"),
    "--no-saved",
  ];
  return { dir, home, flags };
}

/** A port nothing listens on now. */
async function freePort(): Promise<number> {
  return new Promise((ok) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => ok(port));
    });
  });
}

const probe = await probePty();
const skip = "skip" in probe ? probe.skip : undefined;
if (skip !== undefined) console.warn(`tui.e2e: skipped: ${skip}`);

/** The screen, for a failed expectation's message. */
const shown = async (s: PtySession) => `\n${(await s.screen()).join("\n")}`;

describe.skipIf(skip !== undefined)("engram tui under a pseudoconsole", () => {
  const pty = "pty" in probe ? probe.pty : (undefined as never);

  it("renders Home, moves, runs a command and quits with the session's commands", async () => {
    const w = scratch();
    const s = startPty(pty, { main: MAIN, args: ["tui", ...w.flags], cwd: w.dir, home: w.home });
    expect(await s.find("> [r] Read and explain"), await shown(s)).toBe(true);
    expect((await s.screen())[0]).toMatch(/^ engram {2}Home .*person:dana \(person\)/);
    await s.keys("j");
    expect(await s.find("> [o] Read one item"), await shown(s)).toBe(true);
    await s.keys("y"); // Policy in force
    await s.keys("\x13", 200); // ctrl+s runs it
    expect(await s.find("exit 0"), await shown(s)).toBe(true);
    await s.keys("\x1b");
    expect(await s.find("> [y] Policy in force"), await shown(s)).toBe(true);
    await s.keys("q", 0);
    expect(await s.exit(), await shown(s)).toBe(0);
    expect(s.raw()).toContain("\x1b[?1049h");
    const text = await s.text();
    expect(text).toContain("# engram tui: the commands this session ran\n");
    expect(text).toMatch(/\nengram policy[^\n]* {2}# exit 0\n/);
    // The terminal is given back as it was: no frame of the TUI stays in the scrollback.
    expect(text).not.toContain("Read and explain");
    expect(s.uncaught()).toBe("");
  }, 90_000);

  it("quits with q while Serve runs: exit 0, no uncaught error, stopped when the TUI quit", async () => {
    const w = scratch();
    const port = String(await freePort());
    const s = startPty(pty, { main: MAIN, args: ["tui", ...w.flags], cwd: w.dir, home: w.home });
    expect(await s.find("> [r] Read and explain"), await shown(s)).toBe(true);
    await s.keys("h"); // Serve the API and inspector
    expect(await s.find("Who may call it?"), await shown(s)).toBe(true);
    // Insecure loopback, two to the right of the default, then the port field.
    await s.keys("\x1b[C");
    await s.keys("\x1b[C");
    await s.keys("\t");
    await s.keys("\t");
    await s.keys("\x15", 100); // ctrl+u clears the field
    for (const ch of port) await s.keys(ch, 30);
    await s.keys("\x13", 200); // ctrl+s starts it
    expect(await s.find(`127.0.0.1:${port}`), await shown(s)).toBe(true);
    expect(await s.find("running"), await shown(s)).toBe(true);
    await s.keys("\x1b"); // back to Home; the server keeps running
    expect(await s.find("> [h] Serve"), await shown(s)).toBe(true);
    await s.keys("q", 0);
    expect(await s.exit(), s.after()).toBe(0);
    const text = await s.text();
    expect(text).toContain("# engram tui: the commands this session ran\n");
    expect(text).toMatch(
      /\nengram serve --insecure-loopback --port \d+ [^\n]* {2}# exit 0, stopped when the TUI quit\n/,
    );
    expect(s.uncaught()).toBe("");
    expect(s.raw()).not.toMatch(/EPIPE|Uncaught|ERR_STREAM/);
  }, 90_000);

  it("runs line mode on the console: prompts, a command's own output, quit", async () => {
    const w = scratch();
    const s = startPty(pty, {
      main: MAIN,
      args: ["tui", "--line", ...w.flags],
      cwd: w.dir,
      home: w.home,
    });
    expect(await s.find("engram tui, line mode."), await shown(s)).toBe(true);
    expect(await s.find("command:"), await shown(s)).toBe(true);
    await s.keys("policy\r", 200);
    expect(await s.find("exit 0"), await shown(s)).toBe(true);
    await s.keys("quit\r", 0);
    expect(await s.exit(), await shown(s)).toBe(0);
    const raw = s.raw();
    // Line mode never takes the alternate screen and never captures the mouse.
    expect(raw).not.toContain("\x1b[?1049h");
    expect(raw).not.toContain("\x1b[?1000h");
    expect(await s.text()).toMatch(/# engram tui: the commands this session ran\nengram policy/);
    expect(s.uncaught()).toBe("");
  }, 90_000);

  it("switches from Home to line mode with L, on the same console", async () => {
    const w = scratch();
    const s = startPty(pty, { main: MAIN, args: ["tui", ...w.flags], cwd: w.dir, home: w.home });
    expect(await s.find("> [r] Read and explain"), await shown(s)).toBe(true);
    await s.keys("L", 600);
    expect(await s.find("engram tui, line mode."), await shown(s)).toBe(true);
    expect(await s.find("command:"), await shown(s)).toBe(true);
    await s.keys("scopes\r", 200);
    // A read with the store folder: asked once a session (9.5), answered by keys on raw input.
    expect(await s.find("read it? yes or no (default no):"), await shown(s)).toBe(true);
    await s.keys("yes\r", 200);
    expect(await s.find("exit 0"), await shown(s)).toBe(true);
    await s.keys("quit\r", 0);
    expect(await s.exit(), await shown(s)).toBe(0);
    expect(await s.text()).toMatch(/engram scopes --db \S+ --owner dana/);
    expect(s.uncaught()).toBe("");
  }, 90_000);

  it("switches from line mode to the full screen with screen, and q there quits", async () => {
    const w = scratch();
    const s = startPty(pty, {
      main: MAIN,
      args: ["tui", "--line", ...w.flags],
      cwd: w.dir,
      home: w.home,
    });
    expect(await s.find("command:"), await shown(s)).toBe(true);
    await s.keys("policy\r", 200);
    expect(await s.find("exit 0"), await shown(s)).toBe(true);
    await s.keys("screen\r", 600);
    expect(await s.find("> [r] Read and explain"), await shown(s)).toBe(true);
    await s.keys("q", 0);
    expect(await s.exit(), await shown(s)).toBe(0);
    // One summary for the whole session, after the full screen gave the terminal back.
    expect(await s.text()).toMatch(
      /# engram tui: the commands this session ran\nengram policy[^\n]* {2}# exit 0\n/,
    );
    expect(s.uncaught()).toBe("");
  }, 90_000);

  it("leaves line mode on ctrl+Z then Enter, Windows' end of input (review E-2)", async () => {
    const w = scratch();
    const s = startPty(pty, {
      main: MAIN,
      args: ["tui", "--line", ...w.flags],
      cwd: w.dir,
      home: w.home,
    });
    expect(await s.find("command:"), await shown(s)).toBe(true);
    await s.keys("policy\r", 200);
    expect(await s.find("exit 0"), await shown(s)).toBe(true);
    await s.keys("\x1a\r", 0);
    expect(await s.exit(), await shown(s)).toBe(0);
    expect(await s.text()).toMatch(/# engram tui: the commands this session ran\nengram policy/);
    expect(await s.text()).not.toContain("no command is named");
  }, 90_000);

  it("returns from L's child to the full screen with screen, nesting no process (review E-8)", async () => {
    const w = scratch();
    const s = startPty(pty, { main: MAIN, args: ["tui", ...w.flags], cwd: w.dir, home: w.home });
    expect(await s.find("> [r] Read and explain"), await shown(s)).toBe(true);
    await s.keys("L", 600);
    expect(await s.find("command:"), await shown(s)).toBe(true);
    expect(tuiProcesses(w.dir)).toBe(2);
    await s.keys("policy\r", 200);
    expect(await s.find("exit 0"), await shown(s)).toBe(true);
    await s.keys("screen\r", 600);
    expect(await s.find("> [r] Read and explain"), await shown(s)).toBe(true);
    // The child has ended; the parent's full screen is back, alone.
    expect(tuiProcesses(w.dir)).toBe(1);
    await s.keys("L", 600);
    expect(await s.find("command:"), await shown(s)).toBe(true);
    expect(tuiProcesses(w.dir)).toBe(2);
    await s.keys("quit\r", 0);
    expect(await s.exit(), await shown(s)).toBe(0);
    expect(s.uncaught()).toBe("");
  }, 120_000);
});
