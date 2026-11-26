// Argument vectors and the command lines they print as (card E8.15b,
// docs/design/tui.md 4.1 and 6.2): every action of the TUI is an argument
// vector, the one `run` gets; this file turns it into the command line the
// command row shows and `c` copies, quoted for the shell the person is in,
// and splits a pasted command line back into words for the palette.
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

// The pure part lives in ./words.ts since card E8.15e, so line mode shares it without pi-tui.
export { commandLine, detectShell, quote, type Shell, splitWords } from "./words.ts";

/**
 * `text` cut in the middle with `...` when wider than `width`, so the start
 * of the command and its last flags both show (docs/design/tui.md 7).
 */
export function middleCut(text: string, width: number): string {
  if (visibleWidth(text) <= width) return text;
  if (width <= 3) return truncateToWidth(text, width, "");
  const head = Math.ceil((width - 3) / 2);
  const tail = width - 3 - head;
  const chars = [...text];
  let end = "";
  for (let i = chars.length - 1; i >= 0 && visibleWidth(end) < tail; i--) end = chars[i] + end;
  while (visibleWidth(end) > tail) end = end.slice(1);
  return `${truncateToWidth(text, head, "")}...${end}`;
}

/**
 * `text` cut to `width` around `marker`, so the marker stays in sight (the
 * faulty flag's `<here>`, review M9); a middle cut when it holds no marker.
 */
export function cutAround(text: string, width: number, marker: string): string {
  const at = text.indexOf(marker);
  if (at < 0 || visibleWidth(text) <= width) return middleCut(text, width);
  const keep = Math.max(marker.length, width - 6);
  const start = Math.max(
    0,
    Math.min(at - Math.floor((keep - marker.length) / 2), text.length - keep),
  );
  const head = start > 0 ? "..." : "";
  const tail = start + keep < text.length ? "..." : "";
  return truncateToWidth(`${head}${text.slice(start, start + keep)}${tail}`, width, "");
}
