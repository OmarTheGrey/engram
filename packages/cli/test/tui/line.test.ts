// Line mode (card E8.15e, docs/design/tui.md 8.31, 11.6 and 13): a scripted
// stdin produces the transcript of 8.31 with each command's exact output, the
// output the plain CLI prints for the command line shown; an empty Enter
// lists the commands and does not quit; quit and end of input leave, and the
// session's commands are printed unless --quiet; mcp and hook print their
// configuration and never run on the terminal; ENGRAM_TUI_LINE=1, --line and
// a saved line option start it; the CLI's own checks re-ask the field they
// name; the confirmations of 9.5 are asked in words; an answer made as
// another actor is never offered; L on Home switches to line mode keeping
// the workspace and `screen` switches back; line mode imports no pi-tui.
// Fakes only: the files adapter on temporary folders, a fixed clock, a
// counter for ids, a PassThrough for stdin; no network, no model.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { command } from "../../src/registry.ts";
import { type Io, run } from "../../src/run.ts";
import { menuText } from "../../src/tui/line.ts";
import { childArgs, childEnv, type TuiDeps, tuiCommand } from "../../src/tui/main.ts";
import { savedPath, writeSaved } from "../../src/tui/saved.ts";
import { FakeTerminal } from "../../src/tui/term.ts";
import { checkArgv } from "../../src/tui/validate.ts";
import { splitWords } from "../../src/tui/words.ts";
import { NOW, REPO, tempDir, testId } from "../helpers.ts";

const MAIN = join(REPO, "packages", "cli", "src", "main.ts");
const LAUNCH = { command: process.execPath, prefix: [MAIN], note: undefined };
const INTRO =
  "engram tui, line mode. Type a number or a command name; help explains; quit leaves.\n";
const SUMMARY_HEAD = "# engram tui: the commands this session ran\n";
const SAMPLE = "The deploy key rotates every 90 days.";

/** A stream that says it is a terminal and records what is written to it. */
function ttyOut() {
  const s = {
    isTTY: true,
    written: "",
    write: (d: string) => {
      s.written += d;
      return true;
    },
    on: () => s,
  };
  return s;
}

async function folders() {
  const cwd = await tempDir();
  const home = join(cwd, "home");
  mkdirSync(home);
  mkdirSync(join(cwd, "mem"));
  return { cwd, home };
}

interface SessionOptions {
  env?: Record<string, string | undefined>;
  cwd?: string;
  home?: string;
  /** Ends stdin after the typed lines (end of input). */
  eof?: boolean;
  /** A full-screen terminal, for the switches between the two modes. */
  terminal?: FakeTerminal;
  /** Keys for the full screen, sent once it has started. */
  keys?: (t: FakeTerminal) => Promise<void>;
  /** Whether the stdin and stdout streams say they are terminals. */
  tty?: { stdin: boolean; stdout: boolean };
  /** Through run, as `engram tui` is reached, instead of tuiCommand with the test's echo. */
  viaRun?: boolean;
  /** Extra seams of tuiCommand: the App once started, and a line-mode child's hand-back. */
  deps?: Partial<TuiDeps>;
}

/**
 * Runs `engram tui <args>` with `typed` on stdin, one line each. The
 * transcript is everything written to stdout and stderr, in order, with each
 * line read echoed as `> line` (`>` alone for an empty one), as the terminal
 * echoes what the person types.
 */
async function lineSession(args: string[], typed: string[], o: SessionOptions = {}) {
  const f = o.cwd === undefined ? await folders() : { cwd: o.cwd, home: o.home ?? o.cwd };
  const tty = o.tty ?? { stdin: true, stdout: true };
  const stdin = Object.assign(new PassThrough(), { isTTY: tty.stdin });
  const stdout = Object.assign(ttyOut(), { isTTY: tty.stdout });
  let transcript = "";
  let n = 7000;
  const io: Io = {
    out: (s) => {
      transcript += s;
    },
    err: (s) => {
      transcript += s;
    },
    cwd: f.cwd,
    home: f.home,
    now: () => NOW,
    newId: () => testId(++n),
    env: { LANG: "C.UTF-8", ...(o.env ?? {}) },
    nodeVersion: process.versions.node,
    repo: REPO,
    stdin: stdin as unknown as NodeJS.ReadableStream,
    stdout: stdout as unknown as NodeJS.WritableStream,
  };
  stdin.write(typed.map((l) => `${l}\n`).join(""));
  if (o.eof === true) stdin.end();
  const echo = (line: string) => {
    transcript += line === "" ? ">\n" : `> ${line}\n`;
  };
  const done = o.viaRun
    ? run(["tui", ...args], io)
    : tuiCommand(args, io, {
        echo,
        launch: LAUNCH,
        platform: "linux",
        ...(o.terminal ? { terminal: o.terminal } : {}),
        ...(o.deps ?? {}),
      });
  if (o.terminal !== undefined && o.keys !== undefined) await o.keys(o.terminal);
  const code = await done;
  // The folder the session ran in, as <cwd>, so the plain run's output in another folder compares.
  const norm = transcript.replaceAll(f.cwd, "<cwd>");
  return { code, transcript, norm, stdout: stdout.written, ...f };
}

/** The plain CLI's stdout and stderr for `argv` in a fresh workspace like the session's, ids from the same counter. */
async function plain(argv: string[], start = 7000, f?: { cwd: string; home: string }) {
  const where = f ?? (await folders());
  let out = "";
  let n = start;
  const code = await run(argv, {
    out: (s) => {
      out += s;
    },
    err: (s) => {
      out += s;
    },
    cwd: where.cwd,
    home: where.home,
    now: () => NOW,
    newId: () => testId(++n),
    env: { LANG: "C.UTF-8" },
    nodeVersion: process.versions.node,
    repo: REPO,
  });
  return { code, out: out.replaceAll(where.cwd, "<cwd>") };
}

/** The words of the last `run: ` line of a transcript. */
function lastRun(transcript: string): string[] {
  const line = transcript
    .split("\n")
    .filter((l) => l.startsWith("run: "))
    .at(-1);
  return splitWords((line ?? "").slice("run: ".length)) ?? [];
}

const WS = ["--owner", "dana", "--db", "engram.db", "--root", "mem", "--no-saved"];

describe("line mode's transcript (8.31)", () => {
  it("writes as 8.31 does: the menu, an empty Enter, the prompts, the preview, the question and write's own output", async () => {
    const typed = ["", "write", SAMPLE, "", "", "", "", "", "", "", "yes", "quit"];
    const s = await lineSession(["--line", ...WS], typed);
    expect(s.code).toBe(0);
    const argv = [
      "write",
      "--content",
      SAMPLE,
      "--db",
      "engram.db",
      "--owner",
      "dana",
      "--root",
      "mem",
    ];
    const check = await plain(["check", ...argv.slice(1)], 9000);
    const write = await plain(argv);
    expect(write.code).toBe(0);
    const menu = menuText();
    const expected = [
      INTRO,
      "acting as person:dana (person), a member of person:dana\n",
      menu,
      "command: >\n",
      menu,
      "command: > write\n",
      "write one item through the plane's write gate\n",
      `content: > ${SAMPLE}\n`,
      "from file: >\n",
      "scope (default the owner's person scope, else the actor): >\n",
      "class, episodic or semantic (default semantic): >\n",
      "confidence (default 0.9): >\n",
      "valid from (default now): >\n",
      "valid to (default open): >\n",
      "advanced options? yes or no (default no): >\n",
      "the gate would decide, as engram check says (nothing stored, no event):\n",
      check.out,
      `run: engram write --content "${SAMPLE}" --db engram.db --owner dana --root mem\n`,
      "Write a memory?\n",
      "Runs engram write as person:dana (person): the plane decides it and records the decision as an event.\n",
      "It cannot be undone; a later change is a new version or a new event.\n",
      "write it? yes or no (default no): > yes\n",
      write.out,
      "exit 0\n",
      "command: > quit\n",
      SUMMARY_HEAD,
      `engram write --content "${SAMPLE}" --db engram.db --owner dana --root mem  # exit 0\n`,
    ].join("");
    expect(s.norm).toBe(expected);
    // Nothing line mode runs reads or writes the terminal's own streams.
    expect(s.stdout).toBe("");
  });

  it("lists every command the registry offers, each with a number, mcp and hook as setup", () => {
    const menu = menuText();
    for (const name of ["read", "write", "check", "promote", "explain", "doctor", "serve"])
      expect(menu).toMatch(new RegExp(`\\b\\d+ ${name}\\b`));
    expect(menu).toMatch(/\b\d+ mcp setup\b/);
    expect(menu).toMatch(/\b\d+ hook setup\b/);
    expect(menu).not.toMatch(/\btui\b/);
    expect(menu).toMatch(/^memory: 1 read /);
    // No colour, no box drawing, no cursor movement: plain lines only.
    expect(menu.includes(String.fromCharCode(27))).toBe(false);
    expect(menu).not.toMatch(/[┌┐└┘─│]/);
  });

  it("runs a command by its number, as by its name", async () => {
    const number = menuText().match(/(\d+) policy\b/)?.[1];
    expect(number).toBeDefined();
    const s = await lineSession(["--line", ...WS], [number as string, "quit"]);
    expect(s.transcript).toContain(`command: > ${number}\n`);
    const shown = lastRun(s.transcript);
    expect(shown[0]).toBe("policy");
    expect(s.norm).toContain((await plain(shown)).out);
  });

  it("an empty Enter does not quit; end of input leaves and prints the session's commands", async () => {
    const s = await lineSession(["--line", ...WS], ["", "policy"], { eof: true });
    expect(s.code).toBe(0);
    const menu = menuText();
    // Once at the start and once for the empty Enter.
    expect(s.transcript.split(menu)).toHaveLength(3);
    const shown = lastRun(s.transcript);
    const p = await plain(shown);
    expect(s.norm).toContain(`${p.out}exit ${p.code}\ncommand: \n${SUMMARY_HEAD}`);
    expect(s.transcript.endsWith(`engram ${shown.join(" ")}  # exit ${p.code}\n`)).toBe(true);
  });

  it("prints nothing on quit with --quiet", async () => {
    const s = await lineSession(["--line", "--quiet", ...WS], ["policy", "quit"]);
    expect(s.code).toBe(0);
    expect(s.transcript.endsWith("command: > quit\n")).toBe(true);
    expect(s.transcript).not.toContain(SUMMARY_HEAD);
  });

  it("runs a whole command line as typed, with the workspace's flags it does not give", async () => {
    const s = await lineSession(
      ["--line", ...WS],
      [`write --content "Typed whole." --scope person:dana`, "yes", "quit"],
    );
    expect(s.code).toBe(0);
    const shown = lastRun(s.transcript);
    expect(shown).toEqual([
      "write",
      "--content",
      "Typed whole.",
      "--scope",
      "person:dana",
      "--db",
      "engram.db",
      "--owner",
      "dana",
      "--root",
      "mem",
    ]);
    expect(s.norm).toContain(`${(await plain(shown)).out}exit 0\n`);
  });

  it("says what help explains, and help <command> prints its options", async () => {
    const s = await lineSession(["--line", ...WS], ["help", "help write", "quit"]);
    expect(s.transcript).toContain("workspace shows the flags every command gets");
    expect(s.transcript).toContain("screen opens the full-screen interface");
    expect(s.transcript).toContain("  --content <text>            the item's content\n");
  });

  it("answers a name it does not know with the CLI's suggestion", async () => {
    const s = await lineSession(["--line", ...WS], ["wirte", "quit"]);
    expect(s.transcript).toContain(
      'command: > wirte\nno command is named wirte; did you mean "write"? An empty answer lists them.\n',
    );
  });
});

describe("the CLI's own checks (9.4)", () => {
  it("prints the CLI's usage message and asks again for the field it names", async () => {
    const typed = ["write", "x", "", "", "", "high", "", "", "", "0.8", "no", "quit"];
    const s = await lineSession(["--line", ...WS], typed);
    expect(s.code).toBe(0);
    expect(s.transcript).toContain(
      'advanced options? yes or no (default no): >\nengram write: --confidence "high" is not a number\nconfidence (default 0.9): > 0.8\n',
    );
    expect(lastRun(s.transcript)).toContain("0.8");
    expect(s.transcript).toContain(
      "write it? yes or no (default no): > no\ncancelled: nothing ran\n",
    );
    expect(s.transcript).not.toContain(SUMMARY_HEAD);
  });
});

describe("the confirmations of 9.5, in words", () => {
  it("asks before a sweep, with the strong text, and no cancels it", async () => {
    const s = await lineSession(["--line", ...WS], ["retain", "person:dana", "", "", "quit"]);
    expect(s.transcript).toContain(
      "Retiring cannot be undone. Retired items stay in the log; reads no longer return them.\nsweep it? yes or no (default no): >\ncancelled: nothing ran\n",
    );
    expect(s.transcript).not.toContain(SUMMARY_HEAD);
  });

  it("asks before the first read with a store folder in a session, and not before the second", async () => {
    const read = ["read", "", "", ""];
    const s = await lineSession(["--line", ...WS], [...read, "yes", ...read, "quit"]);
    expect(s.code).toBe(0);
    expect(s.transcript.split("Read with mem?\n")).toHaveLength(2);
    expect(s.transcript.split("read it? yes or no (default no): > yes\n")).toHaveLength(2);
    expect(s.transcript.split("\nexit 0\n")).toHaveLength(3);
  });

  it("asks for the key id, typed, before a revocation", async () => {
    const s = await lineSession(
      ["--line", ...WS],
      ["key revoke 01930000-0000-7000-8000-000000000042 --keys keys.json", "", "quit"],
    );
    expect(s.transcript).toContain(
      "This cannot be undone: a revoked key is never accepted again.\ntype 01930000-0000-7000-8000-000000000042 to revoke it, or an empty answer to cancel: >\ncancelled: nothing ran\n",
    );
  });
});

describe("actors (the read id offered)", () => {
  it("offers the last read's id only while the actor who made it is the actor now", async () => {
    const typed = [
      "read",
      "",
      "",
      "",
      "yes",
      "explain",
      "",
      "workspace",
      "owner",
      "sam",
      "",
      "explain",
      "",
      "quit",
    ];
    const s = await lineSession(["--line", ...WS], typed);
    expect(s.code).toBe(0);
    const readId = s.transcript.match(/^read (\S+) at /m)?.[1];
    expect(readId).toBeDefined();
    expect(s.transcript).toContain(`read (default the last read, ${readId}): >\n`);
    // The explanation the plane gave dana, as engram explain prints it.
    const explained = lastRunOf(s.transcript, "explain");
    expect(explained).toContain(readId as string);
    // After the change to sam, dana's read is not offered.
    expect(s.transcript).toContain("--owner sam (set here)");
    const after = s.transcript.slice(
      s.transcript.lastIndexOf("command: > explain"),
      s.transcript.lastIndexOf("command: > quit"),
    );
    expect(after).toContain("read (required): >\nnothing ran: read is required\n");
    expect(after).not.toContain(readId as string);
  });
});

/** The words of the last `run: ` line for a command. */
function lastRunOf(transcript: string, word: string): string[] {
  const line = transcript
    .split("\n")
    .filter((l) => l.startsWith(`run: engram ${word}`))
    .at(-1);
  return splitWords((line ?? "").slice("run: ".length)) ?? [];
}

describe("mcp and hook are setup only (8.14, 8.15)", () => {
  it("prints the MCP configuration for Claude Code and Codex and never runs mcp", async () => {
    const s = await lineSession(["--line", ...WS], ["mcp setup", "", "", "", "", "quit"]);
    expect(s.code).toBe(0);
    expect(s.transcript).toContain("engram mcp is never run here");
    const json = s.transcript.slice(s.transcript.indexOf('{\n  "mcpServers"'));
    const parsed = JSON.parse(json.slice(0, json.indexOf("\n}\n") + 2)) as {
      mcpServers: { engram: { command: string; args: string[] } };
    };
    expect(parsed.mcpServers.engram.command).toBe(process.execPath);
    const args = parsed.mcpServers.engram.args;
    expect(args.slice(0, 2)).toEqual([MAIN, "mcp"]);
    expect(args).toContain("agent:claude-code");
    // Written absolute, as the harness runs it from elsewhere.
    expect(args[args.indexOf("--db") + 1]).toBe(resolve(s.cwd, "engram.db"));
    expect(s.transcript).toContain("[mcp_servers.engram]\n");
    expect(s.transcript).toContain("try it on a scratch log? yes or no (default no): >\n");
    // Never run: stdin was not handed to it (quit was still read), stdout untouched, nothing ran.
    expect(s.transcript.endsWith("command: > quit\n")).toBe(true);
    expect(s.stdout).toBe("");
  });

  it("refuses mcp typed as a command line, and the hook", async () => {
    const s = await lineSession(
      ["--line", ...WS],
      ["mcp --http 7400 --insecure-loopback", "hook claude-code --root mem", "quit"],
    );
    expect(s.transcript).toContain(
      "engram mcp is setup only here: mcp setup prints its configuration; run engram mcp in a shell, or let the harness launch it\n",
    );
    expect(s.transcript).toContain(
      "engram hook is setup only here: hook setup prints its configuration; Claude Code runs the hook\n",
    );
    expect(s.transcript).not.toContain(SUMMARY_HEAD);
    expect(s.stdout).toBe("");
  });

  it("prints the hook's entry and, on request, tries it on a scratch log", async () => {
    const s = await lineSession(["--line", ...WS], ["hook setup", "", "", "", "yes", "quit"]);
    expect(s.code).toBe(0);
    expect(s.transcript).toContain(".claude/settings.json, hooks.PreToolUse:\n");
    expect(s.transcript).toContain('"matcher": "*"');
    expect(s.transcript).toContain(JSON.stringify(resolve(s.cwd, "mem")));
    expect(s.transcript).toMatch(/ok: Read \S+user_role\.md {3}exit 0, blocked/);
    expect(s.transcript).toMatch(/ok: Read \S+README\.md {3}exit 0, allowed/);
    expect(s.transcript).toContain("Try it ran with --db :memory: in place of --db");
    expect(s.transcript).not.toContain(SUMMARY_HEAD);
  }, 60_000);
});

describe("serve in line mode", () => {
  it("runs until Enter, then stops and records it", async () => {
    const s = await lineSession(
      ["--line", ...WS],
      ["serve --insecure-loopback --port 0", "", "quit"],
    );
    expect(s.code).toBe(0);
    expect(s.transcript).toMatch(/engram serve: listening on http:\/\/127\.0\.0\.1:\d+ /);
    expect(s.transcript).toContain(
      "engram serve is running; an empty answer, or end of input, stops it: >\nengram serve: stopped\nexit 0\n",
    );
    expect(s.transcript).toMatch(
      /engram serve --insecure-loopback --port 0 .*# exit 0, stopped from line mode\n$/,
    );
  });
});

describe("how line mode starts", () => {
  it("starts with ENGRAM_TUI_LINE=1, with --line and with a saved line option", async () => {
    for (const o of [
      { args: [], env: { ENGRAM_TUI_LINE: "1" } },
      { args: ["--line"], env: {} },
    ]) {
      const s = await lineSession([...o.args, ...WS], ["quit"], { env: o.env, viaRun: true });
      expect(s.code).toBe(0);
      expect(s.transcript.startsWith(INTRO)).toBe(true);
    }
    const f = await folders();
    writeSaved(f.home, { owner: "dana", db: ":memory:" }, { line: true });
    const saved = await lineSession([], ["quit"], { ...f, viaRun: true });
    expect(saved.transcript.startsWith(INTRO)).toBe(true);
  });

  it("starts where TERM is dumb, which the full screen refuses", async () => {
    const s = await lineSession(["--line", ...WS], ["screen", "quit"], { env: { TERM: "dumb" } });
    expect(s.code).toBe(0);
    expect(s.transcript.startsWith(INTRO)).toBe(true);
    expect(s.transcript).toContain(
      "command: > screen\nengram tui: TERM is dumb; try engram tui --line, or the plain commands\n",
    );
  });

  it("refuses as the full screen does without a terminal, with CI set or with --json", async () => {
    const rows: [SessionOptions, string[], string][] = [
      [{ tty: { stdin: true, stdout: false } }, ["--line"], "stdout is not a terminal"],
      [{ tty: { stdin: false, stdout: true } }, ["--line"], "stdin is not a terminal"],
      [{ env: { CI: "1" } }, ["--line"], "CI is set"],
      [{}, ["--line", "--json"], "--json is for scripts"],
    ];
    for (const [o, args, line] of rows) {
      const s = await lineSession(args, ["quit"], { ...o, viaRun: true });
      expect(s.code).toBe(2);
      expect(s.transcript).toMatch(new RegExp(`^engram tui: ${line}`));
      expect(s.transcript).not.toContain(INTRO);
    }
  });
});

describe("switching between the full screen and line mode (11.6)", () => {
  it("L on Home switches to line mode keeping the workspace; screen switches back", async () => {
    const term = new FakeTerminal({ columns: 80, rows: 24 });
    const tick = () => new Promise((r) => setTimeout(r, 20));
    const s = await lineSession(
      ["--owner", "dana", "--db", "engram.db", "--no-saved"],
      ["scopes", "screen"],
      {
        terminal: term,
        keys: async (t) => {
          for (let i = 0; i < 200 && !t.started; i++) await tick();
          await tick();
          t.send("L");
          // The full screen gives the terminal back, line mode reads, then screen starts it again.
          for (let i = 0; i < 400 && !(t.started && t.output.split("\x1b[?1049h").length > 2); i++)
            await tick();
          await tick();
          t.send("q");
        },
      },
    );
    expect(s.code).toBe(0);
    expect(s.transcript.startsWith(INTRO)).toBe(true);
    expect(lastRun(s.transcript)).toEqual(expect.arrayContaining(["--owner", "dana"]));
    expect(s.transcript).toContain("command: > screen\n");
    expect(term.output.split("\x1b[?1049h")).toHaveLength(3);
    expect(s.transcript).toMatch(
      /# engram tui: the commands this session ran\nengram scopes .*# exit 0\n$/,
    );
  }, 30_000);
});

describe("line mode imports no pi-tui (11.6)", () => {
  it("reaches no pi-tui module from line.ts by a value import", () => {
    const src = resolve(REPO, "packages", "cli", "src");
    const seen = new Set<string>();
    const reached: string[] = [];
    const walk = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+"([^"]+)"/gms)) {
        const spec = m[1] as string;
        reached.push(spec);
        if (spec.startsWith(".")) walk(resolve(dirname(file), spec));
      }
    };
    walk(join(src, "tui", "line.ts"));
    expect(reached.some((r) => r.includes("pi-tui"))).toBe(false);
    expect([...seen].some((f) => f.endsWith(join("tui", "app.ts")))).toBe(false);
    expect(readFileSync(join(src, "tui", "line.ts"), "utf8")).toMatch(/from "node:readline"/);
  });
});

// Card E8.15e's review (findings E-1 to E-4 and E-8).

describe("review E-2: Windows' end of input", () => {
  for (const [name, eot] of [
    ["ctrl+Z then Enter", "\x1a"],
    ["ctrl+D", "\x04"],
  ] as const)
    it(`leaves on a line holding only ${name}, as at the end of input`, async () => {
      const s = await lineSession(["--line", ...WS], ["policy", eot]);
      expect(s.code).toBe(0);
      expect(s.transcript).not.toContain("no command is named");
      expect(s.transcript).toMatch(
        /# engram tui: the commands this session ran\nengram policy {2}# exit 0\n$/,
      );
    });
});

describe("review E-3: a refused command line prints what the plain CLI prints", () => {
  for (const line of ["policy --jsn", "read --rot x"])
    it(`${line}: the CLI's own stderr, did you mean included, and exit 2 shown and recorded`, async () => {
      const s = await lineSession(["--line", ...WS], [line, "quit"]);
      const shown = lastRun(s.transcript);
      expect(shown.slice(0, line.split(" ").length)).toEqual(line.split(" "));
      const p = await plain(shown);
      expect(p.code).toBe(2);
      expect(p.out).toContain("did you mean");
      expect(s.norm).toContain(
        `run: ${s.transcript
          .split("\n")
          .find((l) => l.startsWith("run: "))
          ?.slice(5)}\n${p.out}exit 2\n`.replaceAll(s.cwd, "<cwd>"),
      );
      expect(s.transcript).toMatch(
        new RegExp(
          `# engram tui: the commands this session ran\\nengram ${line.split(" ")[0]} [^\\n]*# exit 2\\n$`,
        ),
      );
    });
});

describe("review E-4: quit and exit leave from any question", () => {
  it("leaves at a yes or no question, running nothing", async () => {
    const s = await lineSession(["--line", ...WS], ["retain --scope person:dana", "quit"]);
    expect(s.code).toBe(0);
    expect(s.transcript).toContain("sweep it? yes or no (default no): > quit\n");
    expect(s.transcript).not.toContain("answer yes or no");
    expect(s.transcript).not.toContain("# engram tui: the commands");
  });

  it("takes exit as quit, at the command prompt and at a question, and says so in help", async () => {
    const a = await lineSession(["--line", ...WS], ["help", "exit"]);
    expect(a.code).toBe(0);
    expect(a.transcript).toContain("quit or exit, at any question, or end of input, leaves");
    expect(a.transcript.endsWith("command: > exit\n")).toBe(true);
    const b = await lineSession(["--line", ...WS], ["write", "exit"]);
    expect(b.code).toBe(0);
    expect(b.transcript.endsWith("content: > exit\n")).toBe(true);
  });
});

describe("review E-1: L keeps the reviewer handoff's actor", () => {
  it("hands the child the handoff apart from its flags, with the session's token (verification R-1)", () => {
    const args = childArgs({ owner: "dana", db: "x.db" }, { quiet: false, noSaved: true });
    expect(args.slice(1)).toEqual([
      "tui",
      "--line",
      "--no-saved",
      "--owner",
      "dana",
      "--db",
      "x.db",
    ]);
    const env = childEnv({ PATH: "p" }, "t0k", {
      reviewer: "person:rev",
      members: ["team:lantern"],
      target: "team:lantern",
    });
    expect(env.ENGRAM_TUI_HANDBACK).toBe("t0k");
    expect(JSON.parse(env.ENGRAM_TUI_HANDOFF as string)).toEqual({
      reviewer: "person:rev",
      members: ["team:lantern"],
      target: "team:lantern",
    });
    expect(
      childEnv({ ENGRAM_TUI_HANDOFF: "{}" }, "t", undefined).ENGRAM_TUI_HANDOFF,
    ).toBeUndefined();
  });

  it("acts as the reviewer in line mode after L, and its intro says so", async () => {
    const term = new FakeTerminal({ columns: 80, rows: 24 });
    const tick = () => new Promise((r) => setTimeout(r, 20));
    let app: { startHandoff(r: string, m: readonly string[]): void } | undefined;
    const s = await lineSession(
      ["--owner", "dana", "--db", "engram.db", "--no-saved"],
      ["events --after 0", "quit"],
      {
        terminal: term,
        deps: {
          onApp: (a) => {
            app = a;
          },
        },
        keys: async (t) => {
          for (let i = 0; i < 200 && !t.started; i++) await tick();
          app?.startHandoff("person:rev", ["team:lantern"]);
          await tick();
          t.send("L");
        },
      },
    );
    expect(s.code).toBe(0);
    expect(s.transcript).toContain("acting as person:rev (person), a member of team:lantern\n");
    expect(lastRun(s.transcript)).toEqual(
      expect.arrayContaining(["--as", "person:rev", "--member", "team:lantern"]),
    );
  }, 30_000);

  it("names the actor in the intro, its level and memberships", async () => {
    const s = await lineSession(["--line", ...WS], ["quit"]);
    expect(
      s.transcript.startsWith(`${INTRO}acting as person:dana (person), a member of person:dana\n`),
    ).toBe(true);
    const none = await lineSession(["--line", "--no-saved"], ["quit"]);
    expect(none.transcript).toContain("acting as no one yet: workspace sets --owner or --as\n");
    // An actor the CLI refuses is named with the CLI's own reason, not as no one.
    const bad = await lineSession(
      ["--line", "--no-saved", "--as", "person:rev", "--member", "org:acme"],
      ["quit"],
    );
    expect(bad.transcript).toContain(
      "acting as person:rev, which every command refuses: --member org:acme is not a scope\n",
    );
  });
});

describe("review E-8: screen in an L child hands back to the parent", () => {
  it("ends the child with its workspace and commands, starting no full screen of its own", async () => {
    const back: unknown[] = [];
    const s = await lineSession(["--line", ...WS], ["policy", "screen"], {
      deps: {
        handBack: (m) => {
          back.push(m);
        },
      },
    });
    expect(s.code).toBe(0);
    expect(back).toHaveLength(1);
    const m = back[0] as {
      given: Record<string, unknown>;
      ran: { argv: string[]; code: number }[];
    };
    expect(m.ran.map((r) => r.argv[0])).toEqual(["policy"]);
    expect(m.given).toMatchObject({ owner: "dana", db: "engram.db" });
    // The parent prints the session's commands; the child prints none.
    expect(s.transcript).not.toContain("# engram tui: the commands");
  });
});

// Card E8.15e's verification (findings R-1 to R-4).

describe("verification R-1: a reviewer handoff stays a session value through L", () => {
  const tick = () => new Promise((r) => setTimeout(r, 20));
  type Apps = {
    startHandoff(r: string, m: readonly string[]): void;
    handoff?: { reviewer: string };
  }[];

  it("lists it as for this session and never saves it to tui.json", async () => {
    const term = new FakeTerminal({ columns: 80, rows: 24 });
    const apps: Apps = [];
    const f = await folders();
    const s = await lineSession(
      ["--owner", "dana", "--db", "engram.db"],
      ["workspace", "level", "person", "", "yes", "quit"],
      {
        ...f,
        terminal: term,
        deps: { onApp: (a) => void apps.push(a as never) },
        keys: async (t) => {
          for (let i = 0; i < 200 && !t.started; i++) await tick();
          apps[0]?.startHandoff("person:rev", ["team:lantern"]);
          await tick();
          t.send("L");
        },
      },
    );
    expect(s.code).toBe(0);
    expect(s.transcript).toContain("--as person:rev (for this session)");
    const saved = readFileSync(savedPath(f.home), "utf8");
    expect(saved).toContain('"level": "person"');
    expect(saved).not.toContain("person:rev");
    expect(saved).not.toContain("team:lantern");
  }, 30_000);

  it("comes back to the full screen as the handoff, with its mark and Switch back", async () => {
    const term = new FakeTerminal({ columns: 120, rows: 40 });
    const apps: (Apps[number] & {
      render(w: number): string[];
      endHandoff(): boolean;
      ws: { actorLabel(): string; savable(): Record<string, unknown> };
    })[] = [];
    let title = "";
    let back = false;
    let after = "";
    let savable: Record<string, unknown> = {};
    const s = await lineSession(
      ["--owner", "dana", "--db", "engram.db", "--no-saved"],
      ["screen"],
      {
        terminal: term,
        deps: { onApp: (a) => void apps.push(a as never) },
        keys: async (t) => {
          for (let i = 0; i < 200 && !t.started; i++) await tick();
          apps[0]?.startHandoff("person:rev", ["team:lantern"]);
          await tick();
          t.send("L");
          for (let i = 0; i < 400 && apps.length < 2; i++) await tick();
          await tick();
          const second = apps[1];
          title = second?.render(120)[0] ?? "";
          savable = second?.ws.savable() ?? {};
          back = second?.endHandoff() ?? false;
          after = second?.ws.actorLabel() ?? "";
          t.send("q");
        },
      },
    );
    expect(s.code).toBe(0);
    expect(title).toContain("person:rev (person) reviewer, for this session");
    expect(savable.as).toBeUndefined();
    expect(back).toBe(true);
    expect(after).toBe("person:dana (person)");
  }, 30_000);
});

describe("verification R-2: a write that creates its store runs as the plain CLI runs it", () => {
  for (const store of ["letta", "files"])
    it(`--store ${store} with a root that does not exist yet: the write runs and exits 0`, async () => {
      const line = `write --content hi --store ${store} --root newroot`;
      const s = await lineSession(
        ["--line", "--owner", "dana", "--db", "engram.db", "--no-saved"],
        [line, "yes", "quit"],
      );
      const shown = lastRun(s.transcript);
      const p = await plain(shown);
      expect(p.code).toBe(0);
      expect(s.norm).toContain(`${p.out}exit 0\n`);
      expect(s.transcript).toMatch(/# exit 0\n$/);
    }, 60_000);

  it("is not refused by the checks the full screen's forms use", async () => {
    const f = await folders();
    const spec = command("write") as NonNullable<ReturnType<typeof command>>;
    const io: Io = {
      out: () => undefined,
      err: () => undefined,
      cwd: f.cwd,
      home: f.home,
      now: () => NOW,
      newId: () => testId(1),
      env: {},
      nodeVersion: process.versions.node,
      repo: REPO,
    };
    const argv = ["write", "--content", "hi", "--store", "letta", "--root", "newroot"];
    expect(checkArgv(spec, [...argv, "--owner", "dana", "--db", "engram.db"], io)).toBeUndefined();
    expect(existsSync(join(f.cwd, "newroot"))).toBe(false);
  });

  it("names a refusal of its own check as line mode's, never as the CLI's, and records no exit code", async () => {
    // check writes nothing, so its check still opens the store read only, where a new Letta root is refused.
    const s = await lineSession(
      ["--line", "--owner", "dana", "--db", "engram.db", "--no-saved"],
      ["check --content hi --store letta --root newroot", "quit"],
    );
    expect(s.transcript).toMatch(/line mode's own check refused it: [^\n]+\nnothing ran\n/);
    expect(s.transcript).not.toMatch(/\nexit \d\n/);
    expect(s.transcript).not.toContain("# engram tui: the commands");
  });
});

describe("verification R-3: the hand-back acts only for the parent that started the child", () => {
  /** An IPC channel the test plays the parent of. */
  function channel(ack: boolean | "other") {
    const sent: unknown[] = [];
    let listener: ((m: unknown) => void) | undefined;
    return {
      sent,
      ipc: {
        send: (m: unknown, done?: () => void) => {
          sent.push(m);
          const hello = (m as { engramTuiHello?: string }).engramTuiHello;
          if (ack === "other" && hello !== undefined)
            setImmediate(() => {
              listener?.({ engramTuiAck: "not-the-token" });
              listener?.({ something: "else" });
            });
          else if (ack && hello !== undefined)
            setImmediate(() => listener?.({ engramTuiAck: hello }));
          done?.();
        },
        on: (_e: "message", f: (m: unknown) => void) => {
          listener = f;
        },
        disconnect: () => undefined,
      },
    };
  }

  it("says there is no full screen to return to under a parent that never answered", async () => {
    const c = channel(false);
    const s = await lineSession(["--line", ...WS], ["screen", "quit"], {
      env: { ENGRAM_TUI_HANDBACK: "a1b2" },
      deps: { ipc: c.ipc },
    });
    expect(s.code).toBe(0);
    expect(s.transcript).toContain(
      "command: > screen\nno full screen to return to: this line mode was not started by L\n",
    );
    expect(c.sent.some((m) => (m as { ran?: unknown }).ran !== undefined)).toBe(false);
  });

  it("takes no other answer, or other message, for the parent's", async () => {
    const c = channel("other");
    const s = await lineSession(["--line", ...WS], ["screen", "quit"], {
      env: { ENGRAM_TUI_HANDBACK: "a1b2" },
      deps: { ipc: c.ipc },
    });
    expect(s.transcript).toContain(
      "no full screen to return to: this line mode was not started by L\n",
    );
    expect(c.sent.some((m) => (m as { ran?: unknown }).ran !== undefined)).toBe(false);
  });

  it("hands back, with the token, to the parent that answered it", async () => {
    const c = channel(true);
    const s = await lineSession(["--line", ...WS], ["policy", "screen"], {
      env: { ENGRAM_TUI_HANDBACK: "a1b2" },
      deps: { ipc: c.ipc },
    });
    expect(s.code).toBe(0);
    const back = c.sent.find((m) => (m as { ran?: unknown }).ran !== undefined) as {
      token: string;
      ran: { argv: string[] }[];
    };
    expect(back.token).toBe("a1b2");
    expect(back.ran.map((r) => r.argv[0])).toEqual(["policy"]);
  });
});

describe("verification R-4: the help says where quit and exit cannot be values", () => {
  it("names the whole command line as the way to give them", async () => {
    const s = await lineSession(["--line", ...WS], ["help", "quit"]);
    expect(s.transcript).toContain(
      "A prompted field cannot take the words quit or exit; type the whole command line to give them, such as write --content quit.",
    );
  });
});
