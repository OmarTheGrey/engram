// Palettes and glyphs (card E8.15b, docs/design/tui.md 11.2, 11.3 and 11.7).
// Colour goes on a status symbol only; its word and every other text keep
// the terminal's default foreground, so reading never depends on a hue. The
// hues are Okabe-Ito's, a dark and a light variant at 4.5:1 or better
// against #1e1e1e and #ffffff; when the background is unknown the terminal's
// own indexed colours are used; high contrast uses no hue at all, only bold
// and underline; no colour uses no colour escape. Focus is reverse video
// everywhere. Nothing here knows what a decision means: a screen names the
// status kind of a word the plane returned.
import { indexedColor, rgbColor, styleText, type TerminalColorMode } from "@earendil-works/pi-tui";

/**
 * "unknown": the terminal named no background, so no hue is safe at 4.5:1 on
 * both a dark and a light one; symbols are bold, with no colour (review M3).
 * "indexed" stays for a person who asks for the terminal's own colours.
 */
export type PaletteName = "dark" | "light" | "indexed" | "unknown" | "high-contrast" | "none";

/** The status kinds of 11.3, each with a symbol and a colour. */
export type StatusKind =
  | "allow"
  | "ok"
  | "deny"
  | "fail"
  | "ask"
  | "warn"
  | "info"
  | "running"
  | "skip"
  | "notyet";

/** The hues of 11.3, for the dark and light backgrounds they were measured against. */
export const HUES = {
  dark: { allow: "#00A67A", deny: "#E86A1A", ask: "#E69F00", info: "#56B4E9" },
  light: { allow: "#00684C", deny: "#A33F00", ask: "#8A5A00", info: "#005A8C" },
} as const;
/** The backgrounds the hues are measured against (11.3). */
export const BACKGROUNDS = { dark: "#1e1e1e", light: "#ffffff" } as const;
/** The terminal's own colours when its background is unknown: green, red, yellow, blue. */
const INDEXED = { allow: 2, deny: 1, ask: 3, info: 4 } as const;

type Hue = keyof (typeof HUES)["dark"];
const HUE_OF: Record<StatusKind, Hue | undefined> = {
  allow: "allow",
  ok: "allow",
  deny: "deny",
  fail: "deny",
  ask: "ask",
  warn: "ask",
  info: "info",
  running: "info",
  skip: undefined,
  notyet: undefined,
};

export interface Glyphs {
  tl: string;
  tr: string;
  bl: string;
  br: string;
  h: string;
  v: string;
  closed: string;
  open: string;
  allow: string;
  deny: string;
  ask: string;
  warn: string;
  skip: string;
  running: string;
  info: string;
  block: string;
  /** The ellipsis of a static busy marker. */
  more: string;
}

/** The Unicode set of 11.7. */
export const UNICODE: Glyphs = {
  tl: "┌",
  tr: "┐",
  bl: "└",
  br: "┘",
  h: "─",
  v: "│",
  closed: "▸",
  open: "▾",
  allow: "✓",
  deny: "✗",
  ask: "◆",
  warn: "▲",
  skip: "·",
  running: "●",
  info: "ℹ",
  block: "█",
  more: "…",
};
/** The ASCII set of 11.7, in the same order. */
export const ASCII: Glyphs = {
  tl: "+",
  tr: "+",
  bl: "+",
  br: "+",
  h: "-",
  v: "|",
  closed: ">",
  open: "v",
  allow: "+",
  deny: "x",
  ask: "?",
  warn: "!",
  skip: "-",
  running: "*",
  info: "i",
  block: "#",
  more: "...",
};
/** conhost: Unicode box drawing, ASCII symbols, until the manual check shows its fonts render them (11.7). */
export const CONHOST: Glyphs = {
  ...ASCII,
  tl: UNICODE.tl,
  tr: UNICODE.tr,
  bl: UNICODE.bl,
  br: UNICODE.br,
  h: UNICODE.h,
  v: UNICODE.v,
};

const SYMBOL_OF: Record<StatusKind, keyof Glyphs> = {
  allow: "allow",
  ok: "allow",
  deny: "deny",
  fail: "deny",
  ask: "ask",
  warn: "warn",
  info: "info",
  running: "running",
  skip: "skip",
  notyet: "skip",
};

export interface Theme {
  palette: PaletteName;
  glyphs: Glyphs;
  /** Which glyph set: unicode, ascii, or conhost's mix. */
  glyphSet: "unicode" | "ascii" | "conhost";
  /** The symbol of a status, coloured as the palette says. */
  symbol(kind: StatusKind): string;
  /** The symbol and the word: `✓ allow`; in high contrast a denial's word is bold and underlined too. */
  status(kind: StatusKind, word: string): string;
  /** Reverse video: focus, the selected row, the title bar. */
  reverse(text: string): string;
  bold(text: string): string;
  underline(text: string): string;
  /** Faint text: a field greyed out because a server names it. */
  dim(text: string): string;
}

const SGR = (on: number, off: number) => (text: string) => `\x1b[${on}m${text}\x1b[${off}m`;
const reverse = SGR(7, 27);
const bold = SGR(1, 22);
const underline = SGR(4, 24);
const dim = SGR(2, 22);

function hexColor(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  return rgbColor((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

export function makeTheme(
  palette: PaletteName,
  glyphSet: Theme["glyphSet"],
  mode: TerminalColorMode = "truecolor",
): Theme {
  const glyphs = glyphSet === "ascii" ? ASCII : glyphSet === "conhost" ? CONHOST : UNICODE;
  const symbol = (kind: StatusKind): string => {
    const s = glyphs[SYMBOL_OF[kind]];
    const hue = HUE_OF[kind];
    if (hue === undefined || palette === "none") return s;
    if (palette === "high-contrast" || palette === "unknown") {
      if (hue === "deny") return bold(underline(s));
      return hue === "info" ? s : bold(s);
    }
    const color = palette === "indexed" ? indexedColor(INDEXED[hue]) : hexColor(HUES[palette][hue]);
    return styleText(s, { fg: color }, mode);
  };
  return {
    palette,
    glyphs,
    glyphSet,
    symbol,
    status: (kind, word) =>
      `${symbol(kind)} ${palette === "high-contrast" && HUE_OF[kind] === "deny" ? bold(underline(word)) : word}`,
    reverse,
    bold,
    underline,
    // Faint text is hard to read in high contrast; the words say it is the server's (review M2).
    dim: palette === "high-contrast" ? (text) => text : dim,
  };
}

export interface ThemeChoice {
  /** --no-color given, or NO_COLOR set to anything non-empty. */
  noColor: boolean;
  /** --high-contrast, or ENGRAM_TUI_CONTRAST=high. */
  highContrast: boolean;
  /** --ascii, or ENGRAM_TUI_ASCII=1. */
  ascii: boolean;
}

type Env = Readonly<Record<string, string | undefined>>;

/** Whether the terminal is Windows' legacy console: Windows, not Windows Terminal, not VS Code (11.7). */
export const isConhost = (env: Env, platform: NodeJS.Platform) =>
  platform === "win32" && !env.WT_SESSION && env.TERM_PROGRAM !== "vscode";

/** The glyph set: ASCII when asked or when the terminal cannot show box drawing, conhost's mix there. */
export function glyphSetFor(choice: ThemeChoice, env: Env, platform: NodeJS.Platform) {
  if (choice.ascii) return "ascii" as const;
  if (env.TERM === "linux" || env.TERM === "vt100") return "ascii" as const;
  if (platform !== "win32") {
    const locale = env.LC_ALL || env.LC_CTYPE || env.LANG || "";
    if (!/utf-?8/i.test(locale)) return "ascii" as const;
  }
  return isConhost(env, platform) ? ("conhost" as const) : ("unicode" as const);
}

/**
 * The background from COLORFGBG ("fg;bg", the bg an ANSI index): 7 and 15
 * are light, 0 to 6 and 8 are dark; anything else is unknown.
 */
export function schemeFromColorFgBg(value: string | undefined): "dark" | "light" | undefined {
  const bg = Number(value?.split(";").at(-1));
  if (!Number.isInteger(bg)) return undefined;
  if (bg === 7 || bg === 15) return "light";
  if ((bg >= 0 && bg <= 6) || bg === 8) return "dark";
  return undefined;
}

/**
 * The palette: none without colour, high contrast when asked, else the
 * variant for the background the terminal reported (`scheme`, from its
 * OSC 11 answer) or COLORFGBG names, else the terminal's indexed colours.
 */
export function paletteFor(
  choice: ThemeChoice,
  env: Env,
  scheme: "dark" | "light" | undefined,
): PaletteName {
  if (choice.noColor) return "none";
  if (choice.highContrast) return "high-contrast";
  return scheme ?? schemeFromColorFgBg(env.COLORFGBG) ?? "unknown";
}

/** Truecolor when COLORTERM says so, else the 256-colour nearest (11.3). */
export const colorModeFor = (env: Env): TerminalColorMode =>
  /^(truecolor|24bit)$/i.test(env.COLORTERM ?? "") ? "truecolor" : "256color";

/** The WCAG relative-luminance contrast ratio of two #rrggbb colours (11.3). */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    const [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
