// Copying a command line (card E8.15b, docs/design/tui.md 4.1). OSC 52 is
// never acknowledged by a terminal, so the path is chosen by terminal, not
// by a reply: OSC 52 where the terminal is known to honour it (Windows
// Terminal, iTerm2, WezTerm, kitty, tmux); pi-tui's native clipboard on
// Windows and macOS elsewhere (conhost and VS Code's terminal included); and
// when neither applies the text is kept and printed when the TUI quits.
import { getNativeClipboard, type NativeClipboard } from "@earendil-works/pi-tui";

export type CopyPath = "osc52" | "native" | "deferred";

type Env = Readonly<Record<string, string | undefined>>;

/** Terminals whose TERM_PROGRAM says they take OSC 52. */
const OSC52_PROGRAMS = new Set(["iTerm.app", "WezTerm"]);

/** The copy path for this terminal (4.1). */
export function copyPath(env: Env, platform: NodeJS.Platform, native: boolean): CopyPath {
  if (env.WT_SESSION || env.KITTY_WINDOW_ID || env.TMUX) return "osc52";
  if (env.TERM_PROGRAM !== undefined && OSC52_PROGRAMS.has(env.TERM_PROGRAM)) return "osc52";
  if ((platform === "win32" || platform === "darwin") && native) return "native";
  return "deferred";
}

/** The OSC 52 sequence that puts `text` on the system clipboard. */
export const osc52 = (text: string) =>
  `\x1b]52;c;${Buffer.from(text, "utf8").toString("base64")}\x07`;

export interface Clipboard {
  readonly path: CopyPath;
  /** Copies `text`; resolves to the status line to show. */
  copy(text: string): Promise<string>;
  /** What could not be copied, in order, to print on quit. */
  readonly deferred: readonly string[];
}

export const COPIED_OSC52 = "copied (sent to the terminal's clipboard, OSC 52)";
export const COPIED = "copied";
export const DEFERRED = "not copied: it will be printed when you quit";

export function createClipboard(options: {
  env: Env;
  platform: NodeJS.Platform;
  /** Where OSC 52 goes: the terminal. */
  write: (data: string) => void;
  /** The native clipboard; pi-tui's by default. */
  native?: () => NativeClipboard | undefined;
}): Clipboard {
  const nativeClipboard = (options.native ?? getNativeClipboard)();
  const canNative = typeof nativeClipboard?.setText === "function";
  const path = copyPath(options.env, options.platform, canNative);
  const deferred: string[] = [];
  const defer = (text: string) => {
    deferred.push(text);
    return DEFERRED;
  };
  return {
    path,
    deferred,
    async copy(text) {
      if (path === "osc52") {
        options.write(osc52(text));
        return COPIED_OSC52;
      }
      if (path === "native" && nativeClipboard?.setText !== undefined) {
        try {
          await nativeClipboard.setText(text);
          return COPIED;
        } catch {
          return defer(text);
        }
      }
      return defer(text);
    },
  };
}
