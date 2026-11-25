// TUI screenshots for the docs (`make tui-screens`): the real App driven
// through the FakeTerminal at 120x36, as a person types, on a seeded
// workspace in a temporary folder, each frame read back from
// @xterm/headless. Every frame is written three ways under
// docs/design/screens/: <name>.ansi (the frame as SGR runs, byte-stable),
// <name>.html (one span per cell run, the TUI's own palette) and <name>.png
// (Chromium through the pinned playwright). The workspace is built from
// fixtures/workspaces/inspector/ (copied, never changed): its policy and its
// writes, each one plain `engram write` in process with a fixed clock and
// ids from a counter. HOME, the log and the store are the temporary
// folder's; tui.json is never read or written (noSaved).
//
//   node packages/cli/scripts/tui-screens.ts [--out <dir>] [--work <dir>] [--only a,b] [--no-png]
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import xterm from "@xterm/headless";
import type { Values } from "../src/registry.ts";
import { type Io, run } from "../src/run.ts";
import { type App, startTui, type TuiOptions } from "../src/tui/app.ts";
import { tuiCommand } from "../src/tui/main.ts";
import type { RunResult } from "../src/tui/runner.ts";
import type { SurfaceScreen } from "../src/tui/screens/surface.ts";
import type { Launch } from "../src/tui/snippets.ts";
import { FakeTerminal } from "../src/tui/term.ts";
import { visibleWidth } from "../src/tui/layout.ts";
import { BACKGROUNDS } from "../src/tui/theme.ts";

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURE = join(REPO, "fixtures", "workspaces", "inspector");
const SIM_WORKLOAD = join(REPO, "fixtures", "workloads", "e8-9-two-presets.json");
export const OUT = join(REPO, "docs", "design", "screens");
export const WORK = join(REPO, ".engram", "tui-screens", "work");

/** The workload's clock: every frame is drawn at this time. */
const NOW = "2026-10-29T12:00:00.000Z";
const ENTER = "\r";
const TAB = "\t";
const ESC = "\x1b";
const CTRL_S = "\x13";
const RIGHT = "\x1b[C";
const DOWN = "\x1b[B";
const SPACE = " ";

/** The command the MCP and hook snippets name, fixed so no path of this machine is drawn. */
const LAUNCH: Launch = { command: "engram", prefix: [], note: undefined };

export type Variant = "dark" | "light" | "high-contrast" | "ascii" | "80col";

interface Step {
  op: "write" | "read";
  as: string;
  at: string;
  item?: { id: string; scope: string; content: string; valid_from: string; class?: string };
}
interface Workload {
  actors: Record<string, { id: string; memberships: string[] }>;
  steps: Step[];
}

/** A counter of ids, as every CLI test draws them: the same log on every run. */
function counter(prefix: string, start: number) {
  let n = start;
  return () => `${prefix}${String(++n).padStart(12, "0")}`;
}

function baseIo(work: string, newId: () => string, sink?: (s: string) => void): Io {
  return {
    out: (s) => sink?.(s),
    err: (s) => sink?.(s),
    cwd: work,
    home: join(work, "home"),
    now: () => NOW,
    newId,
    env: { LANG: "C.UTF-8" },
    nodeVersion: process.versions.node,
    repo: REPO,
  };
}

/** The workspace flags every command of the session takes. */
export const GIVEN: Values = {
  owner: "dana",
  db: "engram.db",
  root: "mem",
  policy: "policy.yaml",
  member: ["person:dana", "team:core"],
};

/**
 * The seeded workspace in `work` (emptied first): the inspector fixture's
 * policy and writes, each one in-process `engram write`, so the log and the
 * files store are what the CLI itself would leave; and a simulate workload.
 */
export async function buildWorkspace(work: string): Promise<void> {
  rmSync(work, { recursive: true, force: true });
  mkdirSync(join(work, "home"), { recursive: true });
  mkdirSync(join(work, "mem"));
  copyFileSync(join(FIXTURE, "policy.yaml"), join(work, "policy.yaml"));
  copyFileSync(SIM_WORKLOAD, join(work, "workload.json"));
  const w = JSON.parse(readFileSync(join(FIXTURE, "workload.json"), "utf8")) as Workload;
  const newId = counter("01960000-0000-7000-8000-", 0);
  for (const step of w.steps) {
    if (step.op !== "write" || step.item === undefined) continue;
    // The fixture's one hostile write is the inspector's escaping test, not a screen.
    if (step.item.content.includes("<script>")) continue;
    const actor = w.actors[step.as];
    if (actor === undefined) throw new Error(`no actor ${step.as}`);
    const argv = [
      ...["write", "--id", step.item.id, "--content", step.item.content],
      ...["--scope", step.item.scope, "--valid-from", step.item.valid_from],
      ...["--db", "engram.db", "--root", "mem", "--owner", "dana", "--policy", "policy.yaml"],
      ...["--as", actor.id, ...actor.memberships.flatMap((m) => ["--member", m])],
      ...["--test-clock", "--at", step.at],
    ];
    let said = "";
    const code = await run(argv, baseIo(work, newId, (s) => (said += s)));
    // A denied fixture write is part of the log (exit 1); anything else is a broken seed.
    if (code !== 0 && !said.includes("deny")) throw new Error(`seed write failed: ${said}`);
  }
}

const OPTIONS: TuiOptions = {
  noColor: false,
  highContrast: false,
  ascii: false,
  reducedMotion: true,
  mouse: false,
  quiet: true,
  noSaved: true,
};

/** Timers that never fire: no busy line or debounced preview lands mid-frame. */
const STILL = {
  later: () => ({ cancel: () => undefined }),
  repeat: () => ({ cancel: () => undefined }),
};

interface Driver {
  app: App;
  /** The workspace folder, which a frame names as DEMO. */
  work: string;
  press(...keys: string[]): Promise<void>;
  type(text: string): Promise<void>;
  focus(id: string): Promise<void>;
  waitFor(text: string, ms?: number): Promise<void>;
  text(): Promise<string>;
}

/** The terminal sizes and theme of a variant. */
function variantOf(v: Variant) {
  return {
    columns: v === "80col" ? 80 : 120,
    rows: v === "80col" ? 24 : 36,
    env: { COLORFGBG: v === "light" ? "0;15" : "15;0", COLORTERM: "truecolor" },
    options: { ...OPTIONS, highContrast: v === "high-contrast", ascii: v === "ascii" },
  };
}

/** One TUI session on `work`, driven by `keys`; the frame it ends on, as the terminal holds it. */
async function session(work: string, v: Variant, keys: (d: Driver) => Promise<void>) {
  const { columns, rows, env, options } = variantOf(v);
  const xt = new xterm.Terminal({ cols: columns, rows, allowProposedApi: true, scrollback: 0 });
  const term = new FakeTerminal({
    columns,
    rows,
    write: (d) => xt.write(d),
    resize: (c, r) => xt.resize(c, r),
  });
  const io: Io = {
    ...baseIo(work, counter("01960000-0000-7000-8000-", 5000)),
    env: { LANG: "C.UTF-8", ...env },
  };
  const { app, tui } = startTui({
    terminal: term,
    io,
    given: GIVEN,
    options,
    platform: "linux",
    native: () => undefined,
    timers: STILL,
  });
  shortenPaths(app, work);
  const flush = () => new Promise<void>((r) => xt.write("", r));
  const frameText = async () => {
    await app.settled();
    tui.renderNow(true);
    await flush();
    const buf = xt.buffer.active;
    const out: string[] = [];
    for (let i = 0; i < xt.rows; i++)
      out.push(buf.getLine(buf.viewportY + i)?.translateToString(true) ?? "");
    return out.join("\n");
  };
  const d: Driver = {
    app,
    work,
    async press(...ks) {
      for (const k of ks) {
        term.send(k);
        await app.settled();
      }
    },
    async type(text) {
      for (const ch of [...text]) {
        term.send(ch);
        await app.settled();
      }
    },
    async focus(id) {
      for (let i = 0; i < 60 && app.top().focused?.() !== id; i++) await d.press(TAB);
      if (app.top().focused?.() !== id)
        throw new Error(`no field ${id}; focused ${app.top().focused?.()}`);
    },
    async waitFor(text, ms = 20_000) {
      const until = Date.now() + ms;
      let shown = "";
      while (Date.now() < until) {
        shown = await frameText();
        if (shown.includes(text)) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`the screen never showed ${JSON.stringify(text)}:\n${shown}`);
    },
    text: frameText,
  };
  await app.settled();
  try {
    await keys(d);
    await frameText();
    return { xt, text: await frameText() };
  } finally {
    app.quit();
    await app.done;
  }
}

/** What a screen shows in place of the workspace folder, as the design's mockups write it. */
export const DEMO = "~/demo";

/** `text` with the workspace folder's absolute path written as ~/demo, its separators as /. */
export function shorten(text: string, work: string): string {
  // As printed, with / separators, and inside JSON (each backslash doubled).
  const forms = [work.replaceAll("\\", "\\\\"), work, work.replaceAll("\\", "/")];
  let out = text;
  for (const w of forms) {
    let i = out.indexOf(w);
    while (i >= 0) {
      let j = i + w.length;
      while (j < out.length && !/[\s"',;)]/.test(out[j] as string)) j++;
      const rest = out.slice(i + w.length, j).replace(/\\+/g, "/");
      out = `${out.slice(0, i)}${DEMO}${rest}${out.slice(j)}`;
      i = out.indexOf(w, i + DEMO.length);
    }
  }
  return out;
}

/**
 * The App's command results with the workspace folder shortened (DEMO), so a
 * frame names no folder of this machine: every result goes through runNow
 * or peek, and only its printed text is changed, never the call it made.
 */
function shortenPaths(app: App, work: string) {
  const fix = (r: RunResult): RunResult => ({
    ...r,
    out: shorten(r.out, work),
    err: shorten(r.err, work),
    ...(r.other === undefined ? {} : { other: shorten(r.other, work) }),
  });
  const runNow = app.runNow.bind(app);
  const peek = app.peek.bind(app);
  app.runNow = async (argv) => {
    const r = fix(await runNow(argv));
    app.results[app.results.length - 1] = r;
    return r;
  };
  app.peek = async (argv) => fix(await peek(argv));
}

/** Reads with the store folder: the first read of a session asks, and y goes on. */
async function readAll(d: Driver) {
  await d.press("r", CTRL_S);
  if (d.app.overlayOnTop()?.kind === "confirm") await d.press("y");
}

export interface ScreenSpec {
  name: string;
  /** The keys, as the index names them. */
  keys: string;
  shows: string;
  variants: Variant[];
  /** Text the frame must hold, so a screen never comes out blank or half drawn. */
  expect: string[];
  drive: (d: Driver) => Promise<void>;
}

const ALL: Variant[] = ["dark", "light", "high-contrast", "ascii", "80col"];

export const SCREENS: ScreenSpec[] = [
  {
    name: "home",
    keys: "(start)",
    shows:
      "Home: the registry's commands in six groups with their access letters, the selected command's summary, what it changes and its exit codes, and the command row it would run.",
    variants: ALL,
    expect: ["Home", "Memory"],
    drive: async () => undefined,
  },
  {
    name: "read",
    keys: "r, ctrl+s, y (the first read with a store folder asks)",
    shows:
      "Read results: the read's id and decision, the counts, the scope lanes and the selected item's explanation (score components and the rule that admitted it).",
    variants: ALL,
    expect: ["allow", "Person scope"],
    drive: readAll,
  },
  {
    name: "explain",
    keys: "r, ctrl+s, y, e",
    shows: "Explain: what the read returned and filtered, item by item, with each rank and score.",
    variants: ["dark"],
    expect: ["Returned"],
    drive: async (d) => {
      await readAll(d);
      await d.press("e");
    },
  },
  {
    name: "item",
    keys: "r, ctrl+s, y, e, enter",
    shows:
      "The item page: the item's current state, its provenance tree, its versions and the events naming it.",
    variants: ["dark"],
    expect: ["Provenance", "Events naming this item"],
    drive: async (d) => {
      await readAll(d);
      await d.press("e", ENTER);
    },
  },
  {
    name: "write-allow",
    keys: "w, type the content, tab to Check, enter, ctrl+s, y",
    shows:
      "A write the gate allows: the decision first, the reason and the policy id verbatim, the event it recorded.",
    variants: ["dark"],
    expect: ["allow", "exit 0"],
    drive: async (d) => {
      await d.press("w");
      await d.type("The deploy key rotates every 90 days.");
      await d.press(CTRL_S);
      if (d.app.overlayOnTop()?.kind === "confirm") await d.press("y");
    },
  },
  {
    name: "write-deny",
    keys: "w, type the content, Scope team:core, Class episodic, ctrl+s, y",
    shows:
      "A write the gate denies: the reason and the policy id verbatim, and that nothing was stored; the decision is an event in the log.",
    variants: ALL,
    expect: ["deny", "exit 1", "policy"],
    drive: async (d) => {
      await d.press("w");
      await d.type("Dana met the auditors this morning.");
      await d.focus("scope");
      await d.type("team:core");
      await d.focus("class");
      await d.press(RIGHT); // episodic
      await d.press(CTRL_S);
      if (d.app.overlayOnTop()?.kind === "confirm") await d.press("y");
    },
  },
  {
    name: "doctor",
    keys: "d, ctrl+s",
    shows:
      "Doctor: every check (log, policy, store, adapters, provider keys by name, pins, Node), failures first, each with what it means.",
    variants: ["dark"],
    expect: ["exit"],
    drive: async (d) => {
      await d.press("d", CTRL_S);
      await d.waitFor("exit");
    },
  },
  {
    name: "grants",
    keys: "r, ctrl+s, y, g, To person:sam, Expires 2026-12-01, ctrl+s, y",
    shows:
      "Grants: the selected item's grants as its owner sees them, one added as a governed change, and u to undo it.",
    variants: ["dark"],
    expect: ["person:sam", "allow"],
    drive: async (d) => {
      await readAll(d);
      await d.press("g");
      await d.focus("to");
      await d.type("person:sam");
      await d.focus("expires");
      await d.type("2026-12-01");
      await d.press(CTRL_S);
      if (d.app.overlayOnTop()?.kind === "confirm") await d.press("y");
    },
  },
  {
    name: "events",
    keys: "e",
    shows:
      "Events: the log as the actor may see it, each decision with its reason and policy id, filters and find.",
    variants: ["dark"],
    expect: ["events"],
    drive: (d) => d.press("e"),
  },
  {
    name: "simulate",
    keys: "s, Workload workload.json, Candidate strict, ctrl+s",
    shows:
      "Simulate: a recorded workload replayed under the policy and a candidate on scratch logs, the totals side by side with bars, and the steps whose decision changed.",
    variants: ["dark"],
    expect: ["workload", "strict"],
    drive: async (d) => {
      await d.press("s");
      await d.type("workload.json");
      await d.focus("candidate");
      await d.type("strict");
      await d.press(CTRL_S);
    },
  },
  {
    name: "mcp",
    keys: "m",
    shows:
      "MCP: the configuration for Claude Code (.mcp.json) and Codex (config.toml) that runs engram mcp over this workspace, and Try it.",
    variants: ["dark"],
    expect: [".mcp.json"],
    drive: async (d) => {
      await d.press("m");
      const screen = d.app.top() as unknown as SurfaceScreen & {
        setLaunch(l: Launch): void;
        snippetArgs(ctx?: unknown): string[];
      };
      screen.setLaunch(LAUNCH);
      // The snippet writes every path absolute (8.15): shown as DEMO, as for every other path.
      const args = screen.snippetArgs.bind(screen);
      screen.snippetArgs = (ctx) => args(ctx).map((a) => shorten(a, d.work));
    },
  },
  {
    name: "serve",
    keys: "h, space, space (No authentication), Port 7391, ctrl+s",
    shows:
      "Serve: who may call the server (keys, a token issuer, or no authentication on loopback), then the running server's start line and the inspector's URL.",
    variants: ["dark"],
    expect: ["listening"],
    drive: async (d) => {
      await d.press("h", SPACE, SPACE);
      await d.focus("port");
      await d.press("\x15");
      await d.type("7391");
      await d.press(CTRL_S);
      await d.waitFor("listening");
      // The start line names the log and the store absolute: shown as DEMO.
      const screen = d.app.top() as unknown as { running?: { out: string } };
      if (screen.running !== undefined) screen.running.out = shorten(screen.running.out, d.work);
    },
  },
  {
    name: "help",
    keys: "?",
    shows: "Help: every key the screen binds, from the key table, and where each acts.",
    variants: ["dark"],
    expect: ["help"],
    drive: (d) => d.press("?"),
  },
  {
    name: "palette",
    keys: "; then type prom",
    shows:
      "The command palette: a fuzzy search over every command, its flags and help line, and the TUI's own actions.",
    variants: ["dark"],
    expect: ["Promote"],
    drive: async (d) => {
      await d.press(";");
      await d.type("prom");
    },
  },
  {
    name: "actor",
    keys: "; then type switch actor, enter",
    shows:
      "The actor switcher: the workspace panel with Acting as focused, each flag with where its value came from.",
    variants: ["dark"],
    expect: ["Acting as"],
    drive: async (d) => {
      await d.press(";");
      await d.type("switch actor");
      await d.press(ENTER);
      await d.type("person:sam");
    },
  },
];

/** The xterm cell's colour as #rrggbb, or undefined for the default. */
function colour(cell: xterm.IBufferCell, which: "fg" | "bg"): string | undefined {
  const isDefault = which === "fg" ? cell.isFgDefault() : cell.isBgDefault();
  if (isDefault) return undefined;
  const rgb = which === "fg" ? cell.isFgRGB() : cell.isBgRGB();
  const n = which === "fg" ? cell.getFgColor() : cell.getBgColor();
  if (rgb) return `#${n.toString(16).padStart(6, "0")}`;
  return ANSI16[n] ?? `p${n}`;
}

/** The 16 colours a palette index names (the TUI's indexed palette uses 1 to 4 only). */
const ANSI16 = [
  "#000000",
  "#cd3131",
  "#0dbc79",
  "#e5e510",
  "#2472c8",
  "#bc3fbc",
  "#11a8cd",
  "#e5e5e5",
  "#666666",
  "#f14c4c",
  "#23d18b",
  "#f5f543",
  "#3b8eea",
  "#d670d6",
  "#29b8db",
  "#ffffff",
];

interface Run {
  text: string;
  fg: string | undefined;
  bg: string | undefined;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
}

/** Each row of the terminal as runs of cells with one style. */
export function runsOf(xt: xterm.Terminal): Run[][] {
  const buf = xt.buffer.active;
  const cell = buf.getNullCell();
  const rows: Run[][] = [];
  for (let y = 0; y < xt.rows; y++) {
    const line = buf.getLine(buf.viewportY + y);
    const runs: Run[] = [];
    for (let x = 0; x < xt.cols; x++) {
      line?.getCell(x, cell);
      if (line === undefined) break;
      if (cell.getWidth() === 0) continue; // the second half of a wide character
      const r: Run = {
        text: cell.getChars() || " ",
        fg: colour(cell, "fg"),
        bg: colour(cell, "bg"),
        bold: cell.isBold() !== 0,
        dim: cell.isDim() !== 0,
        italic: cell.isItalic() !== 0,
        underline: cell.isUnderline() !== 0,
        inverse: cell.isInverse() !== 0,
      };
      const last = runs.at(-1);
      if (
        last !== undefined &&
        last.fg === r.fg &&
        last.bg === r.bg &&
        last.bold === r.bold &&
        last.dim === r.dim &&
        last.italic === r.italic &&
        last.underline === r.underline &&
        last.inverse === r.inverse
      )
        last.text += r.text;
      else runs.push(r);
    }
    rows.push(runs);
  }
  return rows;
}

const hexRgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}`;
};

/** The frame as text with SGR runs: `cat` shows it in a truecolor terminal; byte-stable. */
export function ansiOf(xt: xterm.Terminal): string {
  const lines = runsOf(xt).map((runs) => {
    let s = "";
    for (const r of runs) {
      const sgr = [
        r.bold ? "1" : "",
        r.dim ? "2" : "",
        r.italic ? "3" : "",
        r.underline ? "4" : "",
        r.inverse ? "7" : "",
        r.fg ? `38;2;${hexRgb(r.fg)}` : "",
        r.bg ? `48;2;${hexRgb(r.bg)}` : "",
      ].filter((p) => p !== "");
      s += sgr.length === 0 ? r.text : `\x1b[${sgr.join(";")}m${r.text}\x1b[0m`;
    }
    return s.replace(/ +$/, "");
  });
  return `${lines.join("\n")}\n`;
}

/** The page colours of a variant: the backgrounds theme.ts measures its hues against. */
function pageColours(v: Variant) {
  return v === "light"
    ? { bg: BACKGROUNDS.light, fg: "#1e1e1e" }
    : { bg: BACKGROUNDS.dark, fg: "#d4d4d4" };
}

const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** The frame as a self-contained page: one span per run, the terminal's palette. */
export function htmlOf(xt: xterm.Terminal, v: Variant, title: string): string {
  const page = pageColours(v);
  const rows = runsOf(xt).map((runs) =>
    runs
      .map((r) => {
        let fg = r.fg ?? page.fg;
        let bg = r.bg ?? page.bg;
        if (r.inverse) [fg, bg] = [bg, fg];
        const style = [
          fg === page.fg ? "" : `color:${fg}`,
          bg === page.bg ? "" : `background:${bg}`,
          r.bold ? "font-weight:bold" : "",
          r.dim ? "opacity:.6" : "",
          r.italic ? "font-style:italic" : "",
          r.underline ? "text-decoration:underline" : "",
        ].filter((p) => p !== "");
        // A full block is drawn as a filled cell: fonts leave gaps around the glyph.
        const body = esc(r.text).replace(
          /█+/g,
          (m) => `<span class="b" style="background:${fg}">${" ".repeat(m.length)}</span>`,
        );
        return style.length === 0 ? body : `<span style="${style.join(";")}">${body}</span>`;
      })
      .join(""),
  );
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8">',
    `<title>${esc(title)}</title>`,
    "<style>",
    `html,body{margin:0;background:${page.bg}}`,
    `pre{margin:0;padding:12px;display:inline-block;color:${page.fg};background:${page.bg};`,
    "font:14px/normal 'Cascadia Mono','Cascadia Code',Consolas,'DejaVu Sans Mono','Liberation Mono',Menlo,monospace;",
    "font-variant-ligatures:none}",
    "</style></head><body>",
    `<pre id="frame">${rows.join("\n")}</pre>`,
    "</body></html>",
    "",
  ].join("\n");
}

export interface Shot {
  file: string;
  ansi: string;
  html: string;
  text: string;
  columns: number;
}

const fileName = (name: string, v: Variant) => (v === "dark" ? name : `${name}-${v}`);

/** The frame of one screen in one variant, on a fresh copy of the seeded workspace. */
export async function shoot(spec: ScreenSpec, v: Variant, work: string): Promise<Shot> {
  await buildWorkspace(work);
  const { xt, text } = await session(work, v, spec.drive);
  for (const want of spec.expect)
    if (!text.includes(want))
      throw new Error(`${spec.name} (${v}) does not show ${JSON.stringify(want)}:\n${text}`);
  const file = fileName(spec.name, v);
  return {
    file,
    ansi: ansiOf(xt),
    html: htmlOf(xt, v, `engram tui: ${file}`),
    text,
    columns: xt.cols,
  };
}

/** Line mode (8.31): a scripted session's transcript, one write, drawn as the terminal shows it. */
export async function lineShot(work: string): Promise<Shot> {
  await buildWorkspace(work);
  const typed = [
    "write",
    "The deploy key rotates every 90 days.",
    ...["", "", "", "", "", "", ""],
    "yes",
    "quit",
  ];
  const stdin = Object.assign(new PassThrough(), { isTTY: true });
  const stdout = Object.assign(
    { written: "", write: () => true, on: () => stdout },
    { isTTY: true },
  );
  let transcript = "";
  const io: Io = {
    ...baseIo(work, counter("01960000-0000-7000-8000-", 7000), (s) => {
      transcript += s;
    }),
    stdin: stdin as unknown as NodeJS.ReadableStream,
    stdout: stdout as unknown as NodeJS.WritableStream,
  };
  stdin.write(typed.map((l) => `${l}\n`).join(""));
  const args = ["--line", "--no-saved", ...flagsOf(GIVEN)];
  await tuiCommand(args, io, {
    echo: (line) => {
      transcript += line === "" ? ">\n" : `> ${line}\n`;
    },
    launch: LAUNCH,
    platform: "linux",
  });
  const lines = shorten(transcript, work).replace(/\n$/, "").split("\n");
  // Every line as the terminal wraps it at 120 columns, so the whole transcript is in the frame.
  const rows = Math.max(
    36,
    lines.reduce((n, l) => n + Math.max(1, Math.ceil(visibleWidth(l) / 120)), 0),
  );
  const xt = new xterm.Terminal({ cols: 120, rows, allowProposedApi: true, scrollback: 0 });
  await new Promise<void>((r) => xt.write(lines.join("\r\n"), r));
  return {
    file: "line",
    ansi: ansiOf(xt),
    html: htmlOf(xt, "dark", "engram tui: line"),
    text: transcript,
    columns: 120,
  };
}

function flagsOf(values: Values): string[] {
  return Object.entries(values).flatMap(([k, v]) =>
    Array.isArray(v) ? v.flatMap((x) => [`--${k}`, String(x)]) : [`--${k}`, String(v)],
  );
}

/** Every shot the index lists, in its order. */
export async function shootAll(work: string, only?: Set<string>): Promise<Shot[]> {
  const shots: Shot[] = [];
  for (const spec of SCREENS) {
    if (only !== undefined && !only.has(spec.name)) continue;
    for (const v of spec.variants) shots.push(await shoot(spec, v, work));
  }
  if (only === undefined || only.has("line")) shots.push(await lineShot(work));
  return shots;
}

const VARIANT_WORDS: Record<Variant, string> = {
  dark: "120x36, dark",
  light: "120x36, light",
  "high-contrast": "120x36, --high-contrast",
  ascii: "120x36, --ascii",
  "80col": "80x24, dark",
};

/** docs/design/screens/index.md: each screen, the keys that reach it and what it shows. */
export function indexText(): string {
  const out = [
    "# engram tui screenshots",
    "",
    "Written by `make tui-screens` (`packages/cli/scripts/tui-screens.ts`); do not edit by hand.",
    "Each screen is the real TUI driven through the FakeTerminal, as a person types, on a",
    "workspace seeded in `.engram/tui-screens/work/` from `fixtures/workspaces/inspector/`",
    "(its policy and its writes, each one plain `engram write` with a fixed clock and counted ids).",
    "The workspace flags are `--owner dana --db engram.db --root mem --policy policy.yaml",
    "--member person:dana --member team:core`; the clock is 2026-10-29T12:00:00Z.",
    "Every screen is a fresh session on a fresh copy of that workspace.",
    "The workspace folder's absolute path is shown as `~/demo` (in printed results, the Serve",
    "start line and the MCP snippet), so no frame names a folder of the machine that made it;",
    "the MCP snippet names `engram` as its command; Serve really listens, on 127.0.0.1:7391.",
    "",
    "Beside each PNG: `.ansi` (the frame as SGR runs, `cat` it in a truecolor terminal) and",
    "`.html` (the frame as a page, the palette of `packages/cli/src/tui/theme.ts`). The `.ansi`",
    "files are the byte-stable ones; `packages/cli/test/tui/screens.test.ts` checks a few.",
    "",
    "| screen | file | size and theme | keys | what it shows |",
    "|---|---|---|---|---|",
  ];
  for (const spec of SCREENS)
    for (const v of spec.variants) {
      const f = fileName(spec.name, v);
      out.push(
        `| ${spec.name} | [${f}.png](${f}.png) | ${VARIANT_WORDS[v]} | ${spec.keys} | ${spec.shows} |`,
      );
    }
  out.push(
    "| line | [line.png](line.png) | 120 columns, the whole transcript | `engram tui --line`, then write, the content, enter on each default, yes, quit | Line mode (8.31): sequential prompts in full sentences, the gate's preview as engram check prints it, the question, write's own output, and the session's commands on quit. |",
    "",
  );
  return out.join("\n");
}

/** Screenshots each page with Chromium, the frame only. */
async function pngs(out: string, shots: Shot[]): Promise<void> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const s of shots) {
      await page.goto(`file:///${join(out, `${s.file}.html`).replaceAll("\\", "/")}`);
      await page.evaluate(() => document.fonts.ready);
      await page.locator("#frame").screenshot({ path: join(out, `${s.file}.png`) });
    }
  } finally {
    await browser.close();
  }
}

async function main(argv: string[]) {
  const arg = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const out = resolve(arg("--out") ?? OUT);
  const work = resolve(arg("--work") ?? WORK);
  const onlyArg = arg("--only");
  const only = onlyArg === undefined ? undefined : new Set(onlyArg.split(","));
  mkdirSync(out, { recursive: true });
  const shots = await shootAll(work, only);
  for (const s of shots) {
    writeFileSync(join(out, `${s.file}.ansi`), s.ansi, "utf8");
    writeFileSync(join(out, `${s.file}.html`), s.html, "utf8");
  }
  if (only === undefined) writeFileSync(join(out, "index.md"), indexText(), "utf8");
  if (!argv.includes("--no-png")) await pngs(out, shots);
  rmSync(work, { recursive: true, force: true });
  process.stdout.write(
    `tui-screens: ${shots.length} screens into ${relative(REPO, out) || "."}\n`,
  );
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2));

