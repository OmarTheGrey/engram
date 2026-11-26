// Below 80x24 (card E8.15b, docs/design/tui.md 8.4 and 11.4): no layout, only
// what the TUI needs and the plain command of the screen underneath. The
// session is kept: resizing back restores the screen exactly, with the
// form's input intact. Below 40x5 only the first line shows.
import { wrap } from "../layout.ts";

export const MIN_COLUMNS = 80;
export const MIN_ROWS = 24;

export const tooSmall = (columns: number, rows: number) => columns < MIN_COLUMNS || rows < MIN_ROWS;

/** The too-small screen's lines, exactly `rows` of them. */
export function tooSmallLines(columns: number, rows: number, command: string): string[] {
  const first = `engram tui needs ${MIN_COLUMNS}x${MIN_ROWS}; this terminal is ${columns}x${rows}.`;
  const width = Math.max(1, columns);
  let lines: string[];
  if (columns < 40 || rows < 5) lines = wrap(first, width).slice(0, 1);
  else
    lines = [
      ...wrap(first, width),
      "",
      ...wrap("Widen the window, or press q and run the plain command:", width),
      "",
      ...wrap(`  ${command}`, width),
      "",
      ...wrap("Nothing is lost while you resize.", width),
    ];
  const out = lines.slice(0, rows);
  while (out.length < rows) out.push("");
  return out;
}
