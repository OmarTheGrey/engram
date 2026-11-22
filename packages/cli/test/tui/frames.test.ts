// Snapshot frames (card E8.15b, docs/design/tui.md 13): each screen of the
// frame drawn by the real App on pi-tui, through a FakeTerminal into
// @xterm/headless, at 80x24 and 120x40, in the default, --no-color,
// --high-contrast and --ascii modes, against committed snapshots under
// __frames__/ (the text, then every styled run: colour and attributes). No
// frame line is wider than the terminal and every frame is exactly its
// height; colour is on a status symbol only; --no-color and high contrast
// use no colour at all; --ascii draws no box drawing or Unicode symbol; the
// palettes meet 4.5:1; 79x24 and 80x23 are the too-small screen.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { command } from "../../src/registry.ts";
import { visibleWidth } from "../../src/tui/layout.ts";
import type { RunResult } from "../../src/tui/runner.ts";
import { ResultScreen } from "../../src/tui/screens/form.ts";
import { BACKGROUNDS, contrastRatio, HUES } from "../../src/tui/theme.ts";
import { tempDir } from "../helpers.ts";
import { type Cell, type Harness, type HarnessOptions, startHarness } from "./harness.ts";

type Mode = "default" | "no-color" | "high-contrast" | "ascii";
const MODES: Mode[] = ["default", "no-color", "high-contrast", "ascii"];
const SIZES: [number, number][] = [
  [80, 24],
  [120, 40],
];

const modeOptions = (mode: Mode): HarnessOptions["options"] => ({
  noColor: mode === "no-color",
  highContrast: mode === "high-contrast",
  ascii: mode === "ascii",
});

/** A dark terminal that takes truecolor: the Okabe-Ito dark hues of 11.3. */
const ENV = { COLORFGBG: "15;0", COLORTERM: "truecolor" };

/** A workspace with relative paths, so the frames are the same on every machine. */
async function workspace() {
  const cwd = await tempDir();
  const home = join(cwd, "home");
  mkdirSync(home);
  mkdirSync(join(cwd, "mem"));
  return { cwd, home };
}

const USABLE = { owner: "dana", db: "engram.db", root: "mem" };

/** The screens, each reached by keys from a start. */
const SCREENS: Record<
  string,
  { given: Record<string, string>; keys: (h: Harness) => Promise<void> }
> = {
  home: { given: USABLE, keys: async () => undefined },
  "first-run": { given: {}, keys: async () => undefined },
  loop: {
    given: { db: "engram.db", root: "mem" },
    keys: async (h) => {
      await h.type("dana");
      await h.press("\r", "\r");
    },
  },
  workspace: { given: USABLE, keys: (h) => h.press("\x0f") },
  form: { given: USABLE, keys: (h) => h.press("w") },
  help: { given: USABLE, keys: (h) => h.press("?") },
  palette: {
    given: USABLE,
    keys: async (h) => {
      await h.press(";");
      await h.type("prom");
    },
  },
  confirm: {
    given: USABLE,
    keys: async (h) => {
      await h.press("w");
      await h.type("The deploy key rotates every 90 days.");
      await h.press("\x13");
    },
  },
  // Results from fixed fixture content, so a preset or HELP change elsewhere does not move them (review M16).
  result: { given: USABLE, keys: async (h) => show(h, ALLOWED) },
  denied: { given: USABLE, keys: async (h) => show(h, DENIED) },
};

/** A write's answer as the CLI prints it, fixed here: the frames pin the TUI's drawing, not a preset's words. */
const writeResult = (decision: "allow" | "deny", code: number, reason: string): RunResult => ({
  argv: [
    "write",
    "--content",
    "The deploy key rotates every 90 days.",
    "--scope",
    "team:lantern",
    "--owner",
    "dana",
  ],
  code,
  out: [
    "write 01930000-0000-7000-8000-000000000001 at 2026-10-25T12:00:00.000Z by person:dana",
    `${decision}: ${reason}`,
    "policy fixture/write/team",
    "log engram.db",
    "",
  ].join("\n"),
  err: "",
  calls: [{ method: "POST", path: "/api/v1/items", status: 200, body: { event: { decision } } }],
});
const ALLOWED = writeResult("allow", 0, "a fixture rule admits it");
const DENIED = writeResult(
  "deny",
  1,
  "a fixture rule refuses it: the writer is not a member of team:lantern",
);

async function show(h: Harness, r: RunResult) {
  h.app.push(new ResultScreen(command("write") as never, r, {}));
  await h.frame();
}

/** The styled runs of a frame: consecutive cells of a row with the same style. */
function styleRuns(cells: Cell[]): string[] {
  const key = (c: Cell) =>
    [
      c.fg === "default" ? "" : `fg ${c.fg}`,
      c.bold ? "bold" : "",
      c.underline ? "underline" : "",
      c.inverse ? "inverse" : "",
      c.dim ? "dim" : "",
    ]
      .filter((x) => x !== "")
      .join(" ");
  const out: string[] = [];
  let run: { row: number; from: number; to: number; style: string } | undefined;
  for (const c of cells) {
    const style = key(c);
    if (run !== undefined && run.row === c.row && run.to === c.col - 1 && run.style === style)
      run.to = c.col;
    else {
      if (run !== undefined) out.push(`r${run.row} c${run.from}-${run.to} ${run.style}`);
      run = { row: c.row, from: c.col, to: c.col, style };
    }
  }
  if (run !== undefined) out.push(`r${run.row} c${run.from}-${run.to} ${run.style}`);
  return out;
}

const STATUS_SYMBOLS = new Set(["✓", "✗", "◆", "▲", "●", "ℹ", "+", "x", "?", "!", "*", "i"]);
const UNICODE_DRAWING = /[┌┐└┘─│▸▾✓✗◆▲·●ℹ█…]/;

async function shoot(name: string, mode: Mode, columns: number, rows: number) {
  const s = SCREENS[name] as (typeof SCREENS)[string];
  const { cwd, home } = await workspace();
  const h = await startHarness({
    cwd,
    home,
    env: ENV,
    given: s.given,
    options: modeOptions(mode),
    columns,
    rows,
  });
  await s.keys(h);
  const frame = await h.frame();
  const cells = await h.cells();
  // The frame as the App drew it, before the terminal: no line wider than the terminal.
  const drawn = h.app.render(columns);
  await h.quit();
  return { frame, cells, drawn };
}

describe("snapshot frames", () => {
  for (const name of Object.keys(SCREENS))
    for (const [columns, rows] of SIZES)
      for (const mode of MODES)
        it(`${name} at ${columns}x${rows}, ${mode}`, async () => {
          const { frame, cells, drawn } = await shoot(name, mode, columns, rows);
          expect(drawn).toHaveLength(rows);
          for (const line of drawn) expect(visibleWidth(line)).toBeLessThanOrEqual(columns);
          const coloured = cells.filter((c) => c.fg !== "default");
          if (mode === "no-color" || mode === "high-contrast") expect(coloured).toEqual([]);
          for (const c of coloured)
            expect(STATUS_SYMBOLS, `${name} r${c.row} c${c.col}`).toContain(c.char);
          if (mode === "ascii") expect(frame.join("\n")).not.toMatch(UNICODE_DRAWING);
          const text = `${frame.map((l) => l.replace(/\s+$/, "")).join("\n")}\n--- styles\n${styleRuns(cells).join("\n")}\n`;
          await expect(text).toMatchFileSnapshot(
            `__frames__/${name}-${columns}x${rows}-${mode}.txt`,
          );
        });
});

describe("high contrast (11.3)", () => {
  it("styles a denial bold and underlined, unlike focus, which is reverse video", async () => {
    const { cells } = await shoot("denied", "high-contrast", 80, 24);
    const row = cells.filter((c) => c.row === 1);
    const word = row.filter((c) => "deny".includes(c.char) && c.char !== " ");
    expect(word.length).toBeGreaterThanOrEqual(4);
    for (const c of word) {
      expect(c.bold && c.underline, `r1 c${c.col}`).toBe(true);
      expect(c.inverse, `r1 c${c.col}`).toBe(false);
    }
    const title = cells.filter((c) => c.row === 0);
    expect(title.length).toBeGreaterThan(0);
    for (const c of title) expect(c.inverse && !c.underline).toBe(true);
  });
});

describe("too small", () => {
  for (const [columns, rows] of [
    [79, 24],
    [80, 23],
    [60, 20],
    [39, 4],
  ] as [number, number][])
    it(`${columns}x${rows} is the too-small screen, keeping the command`, async () => {
      const { cwd, home } = await workspace();
      const h = await startHarness({ cwd, home, env: ENV, given: USABLE, columns, rows });
      const frame = await h.frame();
      const first = `engram tui needs 80x24; this terminal is ${columns}x${rows}.`;
      // Its first line, wrapped at the width when the terminal is narrower than it.
      const shown = frame[0]?.trimEnd() ?? "";
      expect(shown.length).toBeGreaterThan(0);
      expect(first.startsWith(shown)).toBe(true);
      if (columns >= first.length) expect(shown).toBe(first);
      if (columns >= 40)
        expect(frame.join("\n")).toContain("engram read --db engram.db --owner dana --root mem");
      else expect(frame.slice(1).every((l) => l.trim() === "")).toBe(true);
      await expect(`${frame.map((l) => l.replace(/\s+$/, "")).join("\n")}\n`).toMatchFileSnapshot(
        `__frames__/too-small-${columns}x${rows}.txt`,
      );
      await h.quit();
    });
});

describe("palettes (11.3)", () => {
  it("puts every hue at 4.5:1 or better against the background it is for", () => {
    for (const hex of Object.values(HUES.dark))
      expect(contrastRatio(hex, BACKGROUNDS.dark)).toBeGreaterThanOrEqual(4.5);
    for (const hex of Object.values(HUES.light))
      expect(contrastRatio(hex, BACKGROUNDS.light)).toBeGreaterThanOrEqual(4.5);
    // The ratios the design states.
    expect(contrastRatio("#00A67A", "#1e1e1e")).toBeCloseTo(5.35, 1);
    expect(contrastRatio("#005A8C", "#ffffff")).toBeCloseTo(7.39, 1);
  });

  it("uses the light hues on a light terminal, the indexed colours when the background is unknown", async () => {
    const { cwd, home } = await workspace();
    for (const [env, expected] of [
      [{ COLORFGBG: "0;15", COLORTERM: "truecolor" }, HUES.light.allow.toUpperCase()],
      [{}, "p2"],
    ] as const) {
      const h = await startHarness({ cwd, home, env, given: {} });
      const tick = (await h.cells()).find((c) => c.char === "✓");
      expect(tick?.fg).toBe(expected);
      await h.quit();
    }
  });

  it("draws conhost's status symbols in ASCII and keeps its box drawing", async () => {
    const { cwd, home } = await workspace();
    const h = await startHarness({ cwd, home, env: {}, given: {}, platform: "win32" });
    const text = await h.text();
    expect(text).not.toMatch(/[✓✗◆▲●ℹ]/);
    expect(text).toContain("+ ok");
    const w = await startHarness({
      cwd,
      home,
      env: { WT_SESSION: "x" },
      given: USABLE,
      platform: "win32",
    });
    expect(await w.text()).toContain("┌");
    await w.quit();
    await h.quit();
  });
});
