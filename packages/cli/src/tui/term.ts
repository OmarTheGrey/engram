// The terminal seam (card E8.15b, docs/design/tui.md 6.4 and 13, ADR 0044):
// the TUI draws on pi-tui's `Terminal` interface, a ProcessTerminal on the
// real console and a FakeTerminal in tests. The fake takes keys and resizes
// from the test and hands every byte written to a sink, which the frame
// tests feed into @xterm/headless; this file imports no test library.
import { ProcessTerminal, type Terminal } from "@earendil-works/pi-tui";

export type { Terminal };

/** The real console: pi-tui's ProcessTerminal (raw mode, Windows VT input, bracketed paste). */
export const processTerminal = (): Terminal => new ProcessTerminal();

export interface FakeTerminalOptions {
  columns: number;
  rows: number;
  /** Every byte the TUI writes, in order (a test feeds them to an emulator). */
  write?: (data: string) => void;
  /** Called when the test resizes the terminal, before the TUI is told. */
  resize?: (columns: number, rows: number) => void;
}

/** A terminal driven by a test: `send` types, `setSize` resizes, `output` holds what was written. */
export class FakeTerminal implements Terminal {
  output = "";
  started = false;
  private cols: number;
  private rws: number;
  private onInput: (data: string) => void = () => undefined;
  private onResize: () => void = () => undefined;
  private readonly sink: ((data: string) => void) | undefined;
  private readonly resized: ((columns: number, rows: number) => void) | undefined;

  constructor(options: FakeTerminalOptions) {
    this.cols = options.columns;
    this.rws = options.rows;
    this.sink = options.write;
    this.resized = options.resize;
  }

  start(onInput: (data: string) => void, onResize: () => void): void {
    this.onInput = onInput;
    this.onResize = onResize;
    this.started = true;
  }
  stop(): void {
    this.started = false;
  }
  async drainInput(): Promise<void> {}
  write(data: string): void {
    this.output += data;
    this.sink?.(data);
  }
  get columns(): number {
    return this.cols;
  }
  get rows(): number {
    return this.rws;
  }
  get kittyProtocolActive(): boolean {
    return false;
  }
  moveBy(lines: number): void {
    if (lines > 0) this.write(`\x1b[${lines}B`);
    else if (lines < 0) this.write(`\x1b[${-lines}A`);
  }
  hideCursor(): void {
    this.write("\x1b[?25l");
  }
  showCursor(): void {
    this.write("\x1b[?25h");
  }
  clearLine(): void {
    this.write("\x1b[2K");
  }
  clearFromCursor(): void {
    this.write("\x1b[J");
  }
  clearScreen(): void {
    this.write("\x1b[2J\x1b[H");
  }
  setTitle(): void {}
  setProgress(): void {}
  setProgramStatus(): void {}

  /** Types `data` as the terminal would deliver it. */
  send(data: string): void {
    this.onInput(data);
  }
  /** Resizes the terminal and tells the TUI. */
  setSize(columns: number, rows: number): void {
    this.cols = columns;
    this.rws = rows;
    this.resized?.(columns, rows);
    this.onResize();
  }
}
