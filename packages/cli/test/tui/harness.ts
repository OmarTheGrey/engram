// The headless TUI for tests (card E8.15b, docs/design/tui.md 13): the real
// App on pi-tui's TuiAltScreen, drawn on a FakeTerminal whose bytes feed
// @xterm/headless, so a frame is read back as the terminal would show it.
// Keys go in through the terminal's input, as a person types them; the clock
// is fixed and ids come from a counter, as in every CLI test.
import xterm from "@xterm/headless";
import type { Values } from "../../src/registry.ts";
import type { Io } from "../../src/run.ts";
import { type App, startTui, type Summary, type TuiOptions } from "../../src/tui/app.ts";
import { FakeTerminal } from "../../src/tui/term.ts";
import { HOME, NOW, REPO, testId } from "../helpers.ts";

export interface HarnessOptions {
  home?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
  options?: Partial<TuiOptions>;
  given?: Values;
  columns?: number;
  rows?: number;
  platform?: NodeJS.Platform;
  transport?: Io["transport"];
}

export const DEFAULT_OPTIONS: TuiOptions = {
  noColor: false,
  highContrast: false,
  ascii: false,
  reducedMotion: false,
  mouse: false,
  quiet: false,
  noSaved: false,
};

/** Cheap doctor probes, so no test opens Mem0 or a MemFS repository. */
const PROBES: Io["doctorProbes"] = {
  "adapter mem0": async () => ["ok", "probe skipped in the TUI tests"],
  "adapter letta": async () => ["ok", "probe skipped in the TUI tests"],
};

let ids = 5000;

export interface Cell {
  row: number;
  col: number;
  char: string;
  fg: string;
  bold: boolean;
  underline: boolean;
  inverse: boolean;
  dim: boolean;
}

export async function startHarness(o: HarnessOptions = {}) {
  const columns = o.columns ?? 80;
  const rows = o.rows ?? 24;
  const xt = new xterm.Terminal({ cols: columns, rows, allowProposedApi: true });
  const term = new FakeTerminal({
    columns,
    rows,
    write: (d) => xt.write(d),
    resize: (c, r) => xt.resize(c, r),
  });
  const io: Io = {
    out: () => undefined,
    err: () => undefined,
    cwd: o.cwd ?? process.cwd(),
    home: o.home ?? HOME,
    now: () => NOW,
    newId: () => testId(++ids),
    env: { LANG: "C.UTF-8", ...(o.env ?? {}) },
    nodeVersion: process.versions.node,
    repo: REPO,
    doctorProbes: PROBES,
    ...(o.transport ? { transport: o.transport } : {}),
  };
  const { app, tui } = startTui({
    terminal: term,
    io,
    given: o.given ?? {},
    options: { ...DEFAULT_OPTIONS, ...(o.options ?? {}) },
    platform: o.platform ?? "linux",
    native: () => undefined,
  });
  const flush = () => new Promise<void>((r) => xt.write("", r));
  const h = {
    app: app as App,
    term,
    xt,
    io,
    screen: () => app.top().kind,
    focused: () => app.top().focused?.(),
    overlay: () => app.overlayOnTop()?.kind,
    /** Sends keys, each handled before the next. */
    async press(...keys: string[]) {
      for (const k of keys) {
        term.send(k);
        await app.settled();
      }
    },
    /** Types text one character at a time. */
    async type(text: string) {
      for (const ch of [...text]) {
        term.send(ch);
        await app.settled();
      }
    },
    /** Tabs until the focused row is `id`. */
    async focusField(id: string) {
      for (let i = 0; i < 40 && h.focused() !== id; i++) await h.press("\t");
      if (h.focused() !== id) throw new Error(`no field ${id}; focused ${h.focused()}`);
    },
    async resize(c: number, r: number) {
      term.setSize(c, r);
      await app.settled();
    },
    /** The screen as the terminal shows it, one string a row. */
    async frame(): Promise<string[]> {
      await app.settled();
      tui.renderNow(true);
      await flush();
      const buf = xt.buffer.active;
      const out: string[] = [];
      for (let i = 0; i < xt.rows; i++) out.push(buf.getLine(buf.viewportY + i)?.translateToString(true) ?? "");
      return out;
    },
    async text(): Promise<string> {
      return (await h.frame()).join("\n");
    },
    /** Every cell that is not plain default text: its colour and attributes. */
    async cells(): Promise<Cell[]> {
      await h.frame();
      const buf = xt.buffer.active;
      const out: Cell[] = [];
      const cell = buf.getNullCell();
      for (let y = 0; y < xt.rows; y++) {
        const line = buf.getLine(buf.viewportY + y);
        if (line === undefined) continue;
        for (let x = 0; x < xt.cols; x++) {
          line.getCell(x, cell);
          const fg = cell.isFgDefault()
            ? "default"
            : cell.isFgRGB()
              ? `#${cell.getFgColor().toString(16).padStart(6, "0").toUpperCase()}`
              : `p${cell.getFgColor()}`;
          const c: Cell = {
            row: y,
            col: x,
            char: cell.getChars(),
            fg,
            bold: cell.isBold() !== 0,
            underline: cell.isUnderline() !== 0,
            inverse: cell.isInverse() !== 0,
            dim: cell.isDim() !== 0,
          };
          if (c.fg !== "default" || c.bold || c.underline || c.inverse || c.dim) out.push(c);
        }
      }
      return out;
    },
    ran: () => app.ran.map((r) => r.argv),
    async quit(): Promise<Summary> {
      app.quit();
      return app.done;
    },
  };
  await app.settled();
  return h;
}

export type Harness = Awaited<ReturnType<typeof startHarness>>;
