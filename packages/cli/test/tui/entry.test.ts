// `engram tui`'s entry (card E8.15b, docs/design/tui.md 5 and 13): each row
// of 5.2 prints its one line, exits 2 and writes no escape sequence; a bad
// flag is the CLI's usage error with its "did you mean" line; bare engram
// prints the help with its new first line and exits 2; on a terminal the TUI
// starts, and quitting prints the session's commands unless --quiet.
import { describe, expect, it } from "vitest";
import { HELP, type Io, run } from "../../src/run.ts";
import { tuiCommand } from "../../src/tui/main.ts";
import { writeSaved } from "../../src/tui/saved.ts";
import { FakeTerminal } from "../../src/tui/term.ts";
import { cli, HOME, NOW, REPO, tempDir, testId } from "../helpers.ts";

/** A stream that says it is a terminal, or not, and records what is written to it. */
const stream = (tty: boolean) => {
  const s = {
    isTTY: tty,
    written: "",
    write: (d: string) => {
      s.written += d;
      return true;
    },
    pause: () => undefined,
  };
  return s;
};

let n = 9000;
function ioFor(
  env: Record<string, string | undefined>,
  tty: { stdin: boolean; stdout: boolean },
  home = HOME,
) {
  const stdin = stream(tty.stdin);
  const stdout = stream(tty.stdout);
  const got = { out: "", err: "" };
  const io: Io = {
    out: (s) => {
      got.out += s;
    },
    err: (s) => {
      got.err += s;
    },
    cwd: home,
    home,
    now: () => NOW,
    newId: () => testId(++n),
    env,
    nodeVersion: process.versions.node,
    repo: REPO,
    stdin: stdin as unknown as NodeJS.ReadableStream,
    stdout: stdout as unknown as NodeJS.WritableStream,
  };
  return { io, got, stdin, stdout };
}

const TTY = { stdin: true, stdout: true };
const ESC = "\x1b";

async function refused(args: string[], env: Record<string, string | undefined>, tty = TTY) {
  const { io, got, stdout } = ioFor(env, tty);
  const code = await run(["tui", ...args], io);
  return { code, ...got, stdout: stdout.written };
}

describe("engram tui refuses to start (5.2)", () => {
  const rows: [string, string[], Record<string, string | undefined>, typeof TTY, string][] = [
    [
      "stdout is not a terminal",
      [],
      {},
      { stdin: true, stdout: false },
      "engram tui: stdout is not a terminal; run the plain commands (engram --help lists them)\n",
    ],
    [
      "stdin is not a terminal",
      [],
      {},
      { stdin: false, stdout: true },
      "engram tui: stdin is not a terminal; run the plain commands (engram --help lists them)\n",
    ],
    [
      "CI is set",
      [],
      { CI: "true" },
      TTY,
      "engram tui: CI is set; run the plain commands (engram --help lists them)\n",
    ],
    [
      "TERM is dumb",
      [],
      { TERM: "dumb" },
      TTY,
      "engram tui: TERM is dumb; try engram tui --line, or the plain commands\n",
    ],
    [
      "--json anywhere",
      ["--owner", "dana", "--json"],
      {},
      TTY,
      "engram tui: --json is for scripts; run the plain command with --json\n",
    ],
    [
      "line mode, until card E8.15e",
      ["--line"],
      {},
      TTY,
      "engram tui: line mode comes with card E8.15e; run the plain commands (engram --help lists them)\n",
    ],
    [
      "ENGRAM_TUI_LINE=1, until card E8.15e",
      [],
      { ENGRAM_TUI_LINE: "1" },
      TTY,
      "engram tui: line mode comes with card E8.15e; run the plain commands (engram --help lists them)\n",
    ],
  ];
  for (const [name, args, env, tty, line] of rows)
    it(`when ${name}: one line, exit 2, no escape sequence`, async () => {
      const r = await refused(args, env, tty);
      expect(r.code).toBe(2);
      expect(r.err).toBe(line);
      expect(r.out).toBe("");
      expect(r.stdout).toBe("");
      expect(r.err).not.toContain(ESC);
    });

  it("checks stdout first, then stdin, then CI, as the table orders them", async () => {
    const both = await refused([], { CI: "1", TERM: "dumb" }, { stdin: false, stdout: false });
    expect(both.err).toMatch(/^engram tui: stdout is not a terminal/);
    const ci = await refused([], { CI: "1", TERM: "dumb" });
    expect(ci.err).toMatch(/^engram tui: CI is set/);
  });

  it("suggests winpty under Git Bash when stdin is a pipe", async () => {
    const r = await refused([], { MSYSTEM: "MINGW64" }, { stdin: false, stdout: false });
    expect(r.err).toBe(
      "engram tui: stdout is not a terminal; run the plain commands (engram --help lists them); under Git Bash, try winpty engram tui\n",
    );
  });

  it("refuses in the plain test harness, which has no terminal at all", async () => {
    const r = await cli(["tui"]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/^engram tui: stdout is not a terminal/);
  });

  it("gives an unknown flag the CLI's usage error and its did-you-mean line", async () => {
    const r = await refused(["--ascci"], {});
    expect(r.code).toBe(2);
    const [first, second, rest] = r.err.split("\n");
    expect(first).toMatch(/^engram tui: Unknown option '--ascci'/);
    expect(second).toBe("engram tui: did you mean --ascii?");
    expect(rest).toBe("");
    expect(r.err).not.toContain(ESC);
  });

  it("refuses a --screen that names no screen, with did you mean", async () => {
    const r = await refused(["--screen", "raed"], {});
    expect(r.code).toBe(2);
    expect(r.err).toBe(
      "engram tui: --screen raed is not a screen: home, workspace, first-run or a command's name\nengram tui: did you mean --screen read?\n",
    );
  });
});

describe("the help names engram tui", () => {
  it("bare engram prints the help with its new first line, on stderr, exit 2", async () => {
    const r = await cli([]);
    expect(r.code).toBe(2);
    expect(r.out).toBe("");
    expect(r.err.split("\n")[0]).toBe(
      "engram: the Engram control plane from the command line; engram tui opens the terminal interface",
    );
  });

  it("lists tui with its line mode, and engram tui --help prints the help", async () => {
    expect(HELP).toContain(
      "\n  tui               the terminal interface; --line or ENGRAM_TUI_LINE=1 for one prompt a line\n",
    );
    expect(HELP).toContain("\ntui options (card E8.15b; docs/design/tui.md):\n");
    const r = await cli(["tui", "--help"]);
    expect(r.code).toBe(0);
    expect(r.out).toBe(HELP);
  });
});

describe("engram tui on a terminal", () => {
  async function session(
    args: string[],
    keys: (term: FakeTerminal) => Promise<void>,
    home?: string,
  ) {
    const h = home ?? (await tempDir());
    const { io, got, stdout } = ioFor({ LANG: "C.UTF-8" }, TTY, h);
    const term = new FakeTerminal({ columns: 80, rows: 24 });
    const done = tuiCommand(args, io, { terminal: term, platform: "linux" });
    for (let i = 0; i < 200 && !term.started; i++) await new Promise((r) => setImmediate(r));
    expect(term.started).toBe(true);
    await keys(term);
    const code = await done;
    return { code, ...got, stdout: stdout.written, term };
  }
  const tick = () => new Promise((r) => setTimeout(r, 20));

  it("starts on the alternate screen, and q on Home quits with exit 0 and nothing to print", async () => {
    const r = await session(["--owner", "dana", "--db", ":memory:"], async (t) => {
      await tick();
      t.send("q");
    });
    expect(r.code).toBe(0);
    expect(r.term.output).toContain("\x1b[?1049h");
    expect(r.term.output).toContain("Home");
    expect(r.out).toBe("");
    expect(r.err).toBe("");
    // The TUI writes to its terminal, never to the Io's stdout stream.
    expect(r.stdout).toBe("");
  });

  it("prints the session's commands on quit, each with its exit code, unless --quiet", async () => {
    const keys = async (t: FakeTerminal) => {
      await tick();
      t.send("y"); // Policy in force: a command that changes nothing
      await tick();
      t.send("\x13"); // ctrl+s runs it
      for (let i = 0; i < 50; i++) await tick();
      t.send("\x03"); // ctrl+c quits now
    };
    const loud = await session(["--owner", "dana", "--db", ":memory:"], keys);
    expect(loud.code).toBe(0);
    expect(loud.out).toBe("# engram tui: the commands this session ran\nengram policy  # exit 0\n");
    const quiet = await session(["--owner", "dana", "--db", ":memory:", "--quiet"], keys);
    expect(quiet.code).toBe(0);
    expect(quiet.out).toBe("");
  });

  it("reads tui.json's options: a saved --ascii draws no box-drawing character", async () => {
    const home = await tempDir();
    writeSaved(home, { owner: "dana", db: ":memory:" }, { ascii: true });
    const r = await session(
      [],
      async (t) => {
        await tick();
        t.send("q");
      },
      home,
    );
    expect(r.code).toBe(0);
    expect(r.term.output).not.toMatch(/[┌┐└┘─│✓✗]/);
    expect(r.term.output).toContain("+-");
  });
});
