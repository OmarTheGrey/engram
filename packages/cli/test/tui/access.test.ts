// Accessibility (card E8.15e, docs/design/tui.md 11 and 10.2), audited item
// by item against the design: 11.1 the mouse and --no-mouse (also
// ENGRAM_TUI_MOUSE=0 and tui.json), with the help overlay saying which; 11.2
// NO_COLOR and --no-color; 11.3 the dark and light palettes, chosen from the
// terminal's answer to the colour query (OSC 11) or COLORFGBG, and high
// contrast from ENGRAM_TUI_CONTRAST=high; 11.5 reduced motion, the busy line
// of 10.2 static instead of four frames (also ENGRAM_TUI_MOTION=reduce);
// 11.6 the screen-reader hint and L; 11.7 ASCII detection; and the session's
// commands on quit unless --quiet. Timers are the test's hand: nothing here
// waits on a clock.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Values } from "../../src/registry.ts";
import type { Io } from "../../src/run.ts";
import type { TuiOptions } from "../../src/tui/app.ts";
import {
  BUSY_AFTER_MS,
  BUSY_FRAME_MS,
  type Cancel,
  COLOR_QUERY_MS,
  type Timers,
} from "../../src/tui/app.ts";
import { tuiCommand, tuiOptions } from "../../src/tui/main.ts";
import { type SavedOptions, writeSaved } from "../../src/tui/saved.ts";
import { FakeTerminal } from "../../src/tui/term.ts";
import {
  BACKGROUND_QUERY,
  backgroundAnswer,
  glyphSetFor,
  HUES,
  schemeOfBackground,
} from "../../src/tui/theme.ts";
import { NOW, REPO, tempDir, testId } from "../helpers.ts";
import { startHarness } from "./harness.ts";

const ESC = String.fromCharCode(27);
const USABLE = { owner: "dana", db: "engram.db", root: "mem" };

async function folders() {
  const cwd = await tempDir();
  const home = join(cwd, "home");
  mkdirSync(home);
  mkdirSync(join(cwd, "mem"));
  return { cwd, home };
}

/** Timers the test fires by hand. */
function handTimers() {
  const later: { fn: () => void; ms: number; live: boolean }[] = [];
  const repeat: { fn: () => void; ms: number; live: boolean }[] = [];
  const add =
    (list: typeof later) =>
    (fn: () => void, ms: number): Cancel => {
      const t = { fn, ms, live: true };
      list.push(t);
      return {
        cancel: () => {
          t.live = false;
        },
      };
    };
  const timers: Timers = { later: add(later), repeat: add(repeat) };
  return {
    timers,
    later,
    repeat,
    fireLater: () => {
      for (const t of later.splice(0)) if (t.live) t.fn();
    },
    tick: () => {
      for (const t of repeat) if (t.live) t.fn();
    },
    live: () => [...later, ...repeat].filter((t) => t.live).length,
  };
}

/** A transport that holds every call until released, and says when one arrived. */
function heldTransport() {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let arrived: () => void = () => undefined;
  const reached = new Promise<void>((r) => {
    arrived = r;
  });
  const transport: Io["transport"] = (fetch) => async (request) => {
    arrived();
    await gate;
    return fetch(request);
  };
  return { transport, reached, release: () => release() };
}

/** `engram tui` through tuiCommand on a fake terminal, q sent once it has started. */
async function session(
  args: string[],
  env: Record<string, string | undefined>,
  o: { home?: string; keys?: (t: FakeTerminal) => Promise<void> } = {},
) {
  const f = await folders();
  const home = o.home ?? f.home;
  const stream = (tty: boolean) => ({
    isTTY: tty,
    write: () => true,
    pause: () => undefined,
    on: () => undefined,
  });
  let out = "";
  const io: Io = {
    out: (s) => {
      out += s;
    },
    err: () => undefined,
    cwd: f.cwd,
    home,
    now: () => NOW,
    newId: (() => {
      let n = 8000;
      return () => testId(++n);
    })(),
    env: { LANG: "C.UTF-8", ...env },
    nodeVersion: process.versions.node,
    repo: REPO,
    stdin: stream(true) as unknown as NodeJS.ReadableStream,
    stdout: stream(true) as unknown as NodeJS.WritableStream,
  };
  const term = new FakeTerminal({ columns: 80, rows: 24 });
  const done = tuiCommand(args, io, { terminal: term, platform: "linux" });
  for (let i = 0; i < 400 && !term.started; i++) await new Promise((r) => setImmediate(r));
  expect(term.started).toBe(true);
  await new Promise((r) => setTimeout(r, 20));
  if (o.keys) await o.keys(term);
  else term.send("q");
  const code = await done;
  return { code, out, output: term.output };
}

const WS = ["--owner", "dana", "--db", ":memory:", "--no-saved"];
/** First run, whose checks draw status symbols: the colour the palettes put on them. */
const FIRST = ["--no-saved"];
/** A colour escape: a foreground of the 16, the 256 or truecolor. */
const COLOUR = new RegExp(`${ESC}\\[(?:[0-9;]*;)?(?:3[0-79]|9[0-7]|38;[25];)[0-9;]*m`);
const MOUSE = ["\x1b[?1000h", "\x1b[?1002h", "\x1b[?1003h"];

describe("11.1 the mouse, optional", () => {
  it("is captured by default, and left to the terminal by --no-mouse, ENGRAM_TUI_MOUSE=0 or tui.json", async () => {
    const tracking = (out: string) => MOUSE.some((s) => out.includes(s));
    expect(tracking((await session(WS, {})).output)).toBe(true);
    expect(tracking((await session([...WS, "--no-mouse"], {})).output)).toBe(false);
    expect(tracking((await session(WS, { ENGRAM_TUI_MOUSE: "0" })).output)).toBe(false);
    const f = await folders();
    writeSaved(f.home, { owner: "dana", db: ":memory:" }, { mouse: false });
    expect(tracking((await session([], {}, { home: f.home })).output)).toBe(false);
  });

  it("says in the help overlay that Shift+drag selects text, or that the mouse is off", async () => {
    const { cwd, home } = await folders();
    for (const [mouse, line] of [
      [true, "The mouse is on: Shift+drag selects text. --no-mouse turns it off."],
      [false, "The mouse is off (--no-mouse): the terminal's own selection works."],
    ] as const) {
      const h = await startHarness({ cwd, home, given: USABLE, options: { mouse } });
      await h.press("?");
      expect(await h.text()).toContain(line);
      await h.quit();
    }
  });
});

describe("11.2 no colour", () => {
  const colourful = { COLORFGBG: "15;0", COLORTERM: "truecolor" };
  it("draws colour on a dark truecolor terminal, and none with NO_COLOR or --no-color", async () => {
    expect((await session(FIRST, colourful)).output).toMatch(COLOUR);
    expect((await session(FIRST, { ...colourful, NO_COLOR: "1" })).output).not.toMatch(COLOUR);
    expect((await session([...FIRST, "--no-color"], colourful)).output).not.toMatch(COLOUR);
  });

  it("takes NO_COLOR only when it is non-empty (no-color.org)", async () => {
    expect((await session(FIRST, { ...colourful, NO_COLOR: "" })).output).toMatch(COLOUR);
  });

  it("keeps reverse video, which carries no hue, with no colour", async () => {
    expect((await session([...FIRST, "--no-color"], colourful)).output).toContain(`${ESC}[7m`);
  });
});

describe("11.3 palettes", () => {
  it("uses no hue with ENGRAM_TUI_CONTRAST=high, as with --high-contrast", async () => {
    const colourful = { COLORFGBG: "15;0", COLORTERM: "truecolor" };
    expect(
      (await session(FIRST, { ...colourful, ENGRAM_TUI_CONTRAST: "high" })).output,
    ).not.toMatch(COLOUR);
  });

  it("tells a dark background from a light one", () => {
    expect(schemeOfBackground({ r: 0x1e, g: 0x1e, b: 0x1e })).toBe("dark");
    expect(schemeOfBackground({ r: 255, g: 255, b: 255 })).toBe("light");
    expect(schemeOfBackground({ r: 0, g: 43, b: 54 })).toBe("dark"); // Solarized dark
    expect(schemeOfBackground({ r: 253, g: 246, b: 227 })).toBe("light"); // Solarized light
    expect(schemeOfBackground(undefined)).toBeUndefined();
  });

  /** The colour of Home's first ✓ after the terminal answers the colour query with `reply`. */
  async function tickAfter(reply: string | undefined, env: Record<string, string> = {}) {
    const { cwd, home } = await folders();
    const h = await startHarness({ cwd, home, env: { COLORTERM: "truecolor", ...env }, given: {} });
    const asked = h.term.output.includes(`${ESC}]11;?`);
    if (reply !== undefined) {
      h.term.send(reply);
      h.term.send(`${ESC}[?62;22c`);
    }
    const tick = (await h.cells()).find((c) => c.char === "✓");
    await h.quit();
    return { asked, fg: tick?.fg, bold: tick?.bold };
  }

  it("asks the terminal for its background, and takes the light hues on a light one", async () => {
    const light = await tickAfter(`${ESC}]11;rgb:ffff/ffff/ffff${ESC}\\`);
    expect(light.asked).toBe(true);
    expect(light.fg).toBe(HUES.light.allow.toUpperCase());
  });

  it("takes the dark hues on a dark one, answered with BEL", async () => {
    const dark = await tickAfter(`${ESC}]11;rgb:1e1e/1e1e/1e1e\x07`);
    expect(dark.fg).toBe(HUES.dark.allow.toUpperCase());
  });

  it("takes the answer whatever comes before it: device attributes first, as a pseudoconsole sends them", async () => {
    const { cwd, home } = await folders();
    const h = await startHarness({ cwd, home, env: { COLORTERM: "truecolor" }, given: {} });
    h.term.send(`${ESC}[?61;4c`);
    h.term.send(`${ESC}]10;rgb:cccc/cccc/cccc${ESC}\\`);
    h.term.send(`${ESC}]11;rgb:0c/0c/0c\x07`);
    const tick = (await h.cells()).find((c) => c.char === "✓");
    expect(tick?.fg).toBe(HUES.dark.allow.toUpperCase());
    await h.quit();
  });

  it("keeps the colourless symbols when the answer comes after the wait", async () => {
    const { cwd, home } = await folders();
    const clock = handTimers();
    const h = await startHarness({ cwd, home, given: {}, timers: clock.timers });
    expect(clock.later.map((t) => t.ms)).toEqual([COLOR_QUERY_MS]);
    clock.fireLater();
    expect(h.screen()).toBe("first-run");
    h.term.send(`${ESC}]11;rgb:ffff/ffff/ffff${ESC}\\`);
    const tick = (await h.cells()).find((c) => c.char === "✓");
    expect(tick?.fg).toBe("default");
    await h.quit();
  });

  // Review E-5: pi-tui 1.3.0 itself drops an OSC answer typed into a field, so the first test
  // below would pass without the TUI's guard; the second holds the guard where it acts.
  it("never types a late answer into a focused field", async () => {
    const { cwd, home } = await folders();
    const h = await startHarness({ cwd, home, given: USABLE });
    await h.press("w");
    expect(h.focused()).toBe("content");
    await h.type("abc");
    h.term.send(`${ESC}]11;rgb:ffff/ffff/ffff${ESC}\\`);
    await h.type("d");
    const text = await h.text();
    expect(text).toContain("[ abcd");
    expect(text).not.toContain("rgb:");
    await h.quit();
  });

  it("hands no OSC 11 answer on to pi-tui, early or late, while other keys pass", async () => {
    const { cwd, home } = await folders();
    const clock = handTimers();
    const h = await startHarness({ cwd, home, given: {}, timers: clock.timers });
    const seen: string[] = [];
    h.tui.addInputListener((data) => {
      seen.push(data);
      return undefined;
    });
    h.term.send(`${ESC}]11;rgb:0c0c/0c0c/0c0c${ESC}\\`);
    clock.fireLater();
    h.term.send(`${ESC}]11;rgb:ffff/ffff/ffff\x07`);
    h.term.send("x");
    await h.frame();
    expect(seen.some((d) => d.includes("]11;"))).toBe(false);
    expect(seen).toContain("x");
    await h.quit();
  });

  it("reads an answer's colour in one to four hex digits a part, and nothing else", () => {
    expect(backgroundAnswer(`${ESC}]11;rgb:ffff/8080/0000${ESC}\\`)?.rgb).toEqual({
      r: 255,
      g: (0x8080 / 0xffff) * 255,
      b: 0,
    });
    expect(backgroundAnswer(`${ESC}]11;rgb:f/0/f\x07`)?.rgb).toEqual({ r: 255, g: 0, b: 255 });
    expect(backgroundAnswer(`${ESC}]11;rgba:1/1/1/1\x07`)).toEqual({ rgb: undefined });
    expect(backgroundAnswer(`${ESC}]10;rgb:ffff/ffff/ffff\x07`)).toBeUndefined();
    expect(backgroundAnswer("q")).toBeUndefined();
    expect(BACKGROUND_QUERY).toBe(`${ESC}]11;?\x07`);
  });

  it("keeps bold symbols with no hue when the terminal does not answer", async () => {
    const none = await tickAfter(undefined);
    expect(none.asked).toBe(true);
    expect(none.fg).toBe("default");
    expect(none.bold).toBe(true);
    expect(COLOR_QUERY_MS).toBeLessThanOrEqual(1000);
  });

  it("does not ask when COLORFGBG names the background, nor with no colour", async () => {
    const { cwd, home } = await folders();
    for (const o of [{ env: { COLORFGBG: "0;15" } }, { env: {}, options: { noColor: true } }]) {
      const h = await startHarness({ cwd, home, given: {}, ...o });
      expect(h.term.output).not.toContain(`${ESC}]11;?`);
      await h.quit();
    }
  });
});

describe("11.5 reduced motion and the busy line of 10.2", () => {
  async function held(reducedMotion: boolean) {
    const { cwd, home } = await folders();
    const clock = handTimers();
    const call = heldTransport();
    const h = await startHarness({
      cwd,
      home,
      // COLORFGBG names the background, so the colour query's wait is not among the timers.
      env: { COLORFGBG: "15;0" },
      given: USABLE,
      options: { reducedMotion },
      transport: call.transport,
      timers: clock.timers,
    });
    const running = h.app.runNow(["policy"]);
    await call.reached;
    return { h, clock, call, running };
  }
  // The pane's last row, above the command row (rows 1 to 21 of 24 are the pane).
  const busyRow = (frame: string[]) => frame[21] ?? "";

  it("says working at once, then after the pause a busy line with four frames at the beat", async () => {
    const { h, clock, call, running } = await held(false);
    const first = await h.frameNow();
    expect(first[22]).toMatch(/^\$ engram policy +working/);
    expect(busyRow(first)).not.toContain("running engram policy");
    expect(clock.later.map((t) => t.ms)).toEqual([BUSY_AFTER_MS]);
    clock.fireLater();
    expect(busyRow(await h.frameNow())).toBe(" - running engram policy".padEnd(80));
    expect(clock.repeat.map((t) => t.ms)).toEqual([BUSY_FRAME_MS]);
    const seen = [];
    for (let i = 0; i < 4; i++) {
      clock.tick();
      seen.push(
        busyRow(await h.frameNow())
          .trim()
          .split(" ")[0],
      );
    }
    expect(seen).toEqual(["\\", "|", "/", "-"]);
    call.release();
    await running;
    expect(busyRow(await h.frameNow())).not.toContain("running engram policy");
    expect(clock.live()).toBe(0);
    await h.quit();
  });

  it("under --reduced-motion shows a static marker and starts no frames", async () => {
    const { h, clock, call, running } = await held(true);
    clock.fireLater();
    expect(busyRow(await h.frameNow())).toBe(" … running engram policy".padEnd(80));
    expect(clock.repeat).toEqual([]);
    call.release();
    await running;
    await h.quit();
  });
});

describe("the options from flags, the environment and tui.json (5.1, 11)", () => {
  const none = {};
  it("reads each option's flag, its variable and its saved value", () => {
    const off = tuiOptions(none, {}, undefined);
    expect(off).toEqual({
      noColor: false,
      highContrast: false,
      ascii: false,
      reducedMotion: false,
      mouse: true,
      quiet: false,
      noSaved: false,
    });
    const rows: [Values, Record<string, string>, SavedOptions | undefined, Partial<TuiOptions>][] =
      [
        [{ "no-color": true }, {}, undefined, { noColor: true }],
        [none, { NO_COLOR: "1" }, undefined, { noColor: true }],
        [none, { NO_COLOR: "" }, undefined, {}],
        [{ "high-contrast": true }, {}, undefined, { highContrast: true }],
        [none, { ENGRAM_TUI_CONTRAST: "high" }, undefined, { highContrast: true }],
        [none, {}, { contrast: "high" }, { highContrast: true }],
        [{ ascii: true }, {}, undefined, { ascii: true }],
        [none, { ENGRAM_TUI_ASCII: "1" }, undefined, { ascii: true }],
        [none, {}, { ascii: true }, { ascii: true }],
        [{ "reduced-motion": true }, {}, undefined, { reducedMotion: true }],
        [none, { ENGRAM_TUI_MOTION: "reduce" }, undefined, { reducedMotion: true }],
        [none, {}, { motion: "reduce" }, { reducedMotion: true }],
        [{ "no-mouse": true }, {}, undefined, { mouse: false }],
        [none, { ENGRAM_TUI_MOUSE: "0" }, undefined, { mouse: false }],
        [none, {}, { mouse: false }, { mouse: false }],
        [{ quiet: true }, {}, undefined, { quiet: true }],
      ];
    for (const [values, env, saved, want] of rows)
      expect(tuiOptions(values, env, saved), JSON.stringify([values, env, saved])).toEqual({
        ...off,
        ...want,
      });
  });
});

describe("11.6 the screen-reader hint and L", () => {
  it("says on first run's first screen how to reach line mode", async () => {
    const { cwd, home } = await folders();
    const h = await startHarness({ cwd, home, given: {} });
    expect(h.screen()).toBe("first-run");
    expect((await h.text()).replace(/\s+/g, " ")).toContain(
      "Using a screen reader? Press L for line mode, or set ENGRAM_TUI_LINE=1.",
    );
    await h.press("L");
    const s = await h.app.done;
    expect(s.line).toBe(true);
  });

  it("switches from Home with L, and lists line mode in the palette", async () => {
    const { cwd, home } = await folders();
    const h = await startHarness({ cwd, home, given: USABLE });
    await h.press(";");
    await h.type("line mode");
    expect(await h.text()).toContain("L on Home, or engram tui --line");
    await h.press("\r");
    expect((await h.app.done).line).toBe(true);
  });
});

describe("the terminal given back on quit (review E-5)", () => {
  it("leaves the alternate screen and writes no frame after it, so nothing stays in the scrollback", async () => {
    const { cwd, home } = await folders();
    const h = await startHarness({ cwd, home, given: USABLE });
    expect(await h.text()).toContain("Read and explain");
    await h.quit();
    const out = h.term.output;
    const left = out.lastIndexOf("\x1b[?1049l");
    expect(left).toBeGreaterThan(out.indexOf("\x1b[?1049h"));
    const after = out.slice(left);
    expect(after).not.toContain("Read and explain");
    expect(after).not.toContain("engram  Home");
  });
});

describe("the title bar names the actor (manual check, conhost)", () => {
  it("drops a long log path, then the connection, before the actor", async () => {
    const { cwd, home } = await folders();
    const db = `${"deep/".repeat(18)}engram.db`;
    const h = await startHarness({
      cwd,
      home,
      given: { owner: "dana", db, root: "mem" },
      columns: 120,
      rows: 40,
    });
    const title = (await h.frame())[0] ?? "";
    expect(title).toMatch(/^ engram {2}Home +in process {2}person:dana \(person\) $/);
    expect(title).not.toContain("deep/");
    await h.resize(80, 24);
    expect((await h.frame())[0]).toMatch(/person:dana \(person\) $/);
    await h.quit();
  });
});

describe("11.7 ASCII detection", () => {
  const choice = { noColor: false, highContrast: false, ascii: false };
  const rows: [string, Record<string, string>, NodeJS.Platform, string][] = [
    ["--ascii", {}, "linux", "ascii"],
    ["TERM=linux", { TERM: "linux", LANG: "C.UTF-8" }, "linux", "ascii"],
    ["TERM=vt100", { TERM: "vt100", LANG: "en_US.UTF-8" }, "darwin", "ascii"],
    ["a POSIX locale without UTF-8", { LANG: "C" }, "linux", "ascii"],
    ["no locale at all on POSIX", {}, "darwin", "ascii"],
    ["LC_ALL before LANG", { LC_ALL: "C", LANG: "en_US.UTF-8" }, "linux", "ascii"],
    ["LC_CTYPE before LANG", { LC_CTYPE: "en_US.utf8", LANG: "C" }, "linux", "unicode"],
    ["a UTF-8 locale", { LANG: "en_US.UTF-8" }, "linux", "unicode"],
    ["conhost: Windows, no WT_SESSION, not VS Code", {}, "win32", "conhost"],
    ["Windows Terminal", { WT_SESSION: "x" }, "win32", "unicode"],
    ["VS Code's terminal on Windows", { TERM_PROGRAM: "vscode" }, "win32", "unicode"],
    // The manual check: Git Bash's mintty sets TERM_PROGRAM=mintty and renders every glyph.
    ["Git Bash's mintty", { TERM_PROGRAM: "mintty" }, "win32", "unicode"],
    ["WezTerm on Windows", { TERM_PROGRAM: "WezTerm" }, "win32", "unicode"],
  ];
  for (const [name, env, platform, set] of rows)
    it(`${name}: ${set}`, () => {
      expect(glyphSetFor({ ...choice, ascii: name === "--ascii" }, env, platform)).toBe(set);
    });

  it("takes ENGRAM_TUI_ASCII=1 at the start: no box drawing, no Unicode symbol", async () => {
    const r = await session(WS, { ENGRAM_TUI_ASCII: "1" });
    expect(r.output).not.toMatch(/[┌┐└┘─│✓✗◆▲·●ℹ█…]/);
    expect(r.output).toContain("+-");
  });
});
