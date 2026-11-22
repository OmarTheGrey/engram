// Drawing helpers (card E8.15b): lines padded or cut to a width, boxes in
// the theme's glyphs, two panes side by side, an overlay composited over a
// frame. Widths are pi-tui's visibleWidth, east Asian widths included, so
// content in any script lays out (docs/design/tui.md 11.7).
import {
  compositeTuiLine,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import type { Theme } from "./theme.ts";

export { visibleWidth };

/** `text` cut to `width` with no ellipsis and padded to exactly `width`. */
export const fit = (text: string, width: number) =>
  width <= 0 ? "" : truncateToWidth(text, width, "", true);

/** `text` cut to `width` with `...`, padded to exactly `width`. */
export const cut = (text: string, width: number) =>
  width <= 0 ? "" : truncateToWidth(text, width, "...", true);

/** `text` wrapped at `width`, each line cut to it in case a word is longer. */
export const wrap = (text: string, width: number): string[] =>
  width <= 0 ? [] : wrapTextWithAnsi(text, width).map((l) => truncateToWidth(l, width, ""));

/** Exactly `height` lines: cut, or padded with blank ones. */
export function rows(lines: readonly string[], height: number, width: number): string[] {
  const out = lines.slice(0, Math.max(0, height)).map((l) => fit(l, width));
  while (out.length < height) out.push(" ".repeat(Math.max(0, width)));
  return out;
}

/** A box of `width` by `height` with `title` in its top border and `body` inside. */
export function box(
  theme: Theme,
  title: string,
  body: readonly string[],
  width: number,
  height: number,
): string[] {
  const g = theme.glyphs;
  const inner = Math.max(0, width - 2);
  const head = title === "" ? "" : `${g.h} ${title} `;
  const top = `${g.tl}${truncateToWidth(head + g.h.repeat(inner), inner, "")}${g.tr}`;
  const lines = [top];
  for (const line of rows(body, Math.max(0, height - 2), inner)) lines.push(`${g.v}${line}${g.v}`);
  lines.push(`${g.bl}${g.h.repeat(inner)}${g.br}`);
  return lines;
}

/** Two columns of lines side by side; the shorter is padded with blanks of its width. */
export function sideBySide(
  left: readonly string[],
  leftWidth: number,
  right: readonly string[],
  rightWidth: number,
): string[] {
  const n = Math.max(left.length, right.length);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(fit(left[i] ?? "", leftWidth) + fit(right[i] ?? "", rightWidth));
  return out;
}

/** `over` composited onto `base` at (`row`, `col`), each overlay line `width` wide. */
export function overlay(
  base: string[],
  over: readonly string[],
  row: number,
  col: number,
  width: number,
  total: number,
): string[] {
  const out = [...base];
  for (let i = 0; i < over.length; i++) {
    const at = row + i;
    if (at < 0 || at >= out.length) continue;
    out[at] = compositeTuiLine(out[at] ?? "", fit(over[i] ?? "", width), col, width, total);
  }
  return out;
}
