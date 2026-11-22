// The contract between the router (./app.ts) and its screens and overlays
// (card E8.15b). A screen draws its body, names its key hints and the
// command its command line row shows, and acts on the key table's actions
// (./app.ts KEYS); keys a text field types are handed to it raw. Types only,
// so the screens and the router import each other's shapes without a cycle.
import type { CommandSpec, Values } from "../registry.ts";
import type { Io } from "../run.ts";
import type { Shell } from "./argv.ts";
import type { RunResult } from "./runner.ts";
import type { Theme } from "./theme.ts";
import type { CheapChecks, Workspace } from "./workspace.ts";

/** The screens the key table is written for. */
export type ScreenKind =
  | "home"
  | "first-run"
  | "loop"
  | "workspace"
  | "form"
  | "result"
  | "too-small";

/** The overlays, which take the keys while open. */
export type OverlayKind = "help" | "palette" | "confirm";

/** What the command line row shows. */
export interface CommandRow {
  /** The argument vector after `engram`: shown quoted for the shell. */
  argv?: readonly string[];
  /** Text shown instead, for a screen whose flags apply to every command. */
  text?: string;
  /** The exit code of the run it shows. */
  exit?: number;
  /** A note after the command: "(every command)", "(refused: choose another)". */
  note?: string;
}

export interface Screen {
  readonly kind: ScreenKind;
  /** The title bar's screen name. */
  title(ctx: Ctx): string;
  /** Exactly `height` lines of the body, each `width` wide (the router pads them). */
  render(ctx: Ctx, width: number, height: number): string[];
  /** Acts on a key table action; true when it did. */
  action(name: string, ctx: Ctx): boolean | Promise<boolean>;
  /** Whether a text field has focus, so printable keys type into it. */
  inField(): boolean;
  /** A key the key table does not bind here, or a printable key in a field: true when used. */
  raw(data: string, ctx: Ctx): boolean;
  /** The command line row. */
  command(ctx: Ctx): CommandRow;
  /** This screen's key hints, before the ones every screen has. */
  hints(ctx: Ctx): string;
  /** The registry entry whose help the overlay shows, if any. */
  spec?(ctx: Ctx): CommandSpec | undefined;
  /** Whether a press at a terminal row (0-based) is a click this screen takes. */
  clickable?(row: number): boolean;
  /** A click at a terminal row, `count` 2 for a double click. */
  clickAt?(row: number, count: number, ctx: Ctx): boolean | Promise<boolean>;
  /** The id of the focused field or row, for tests and the help overlay. */
  focused?(): string | undefined;
}

export interface Overlay {
  readonly kind: OverlayKind;
  /** The overlay's lines, at most `height`, each at most `width` wide. */
  render(ctx: Ctx, width: number, height: number): string[];
  /** Its width at a terminal width. */
  width(total: number): number;
  action(name: string, ctx: Ctx): boolean | Promise<boolean>;
  inField(): boolean;
  raw(data: string, ctx: Ctx): boolean;
}

/** One command the session ran, for the summary printed on quit. */
export interface Ran {
  argv: readonly string[];
  code: number;
}

export interface ConfirmRequest {
  title: string;
  /** What will happen, in sentences; each a paragraph. */
  lines: readonly string[];
  /** The exact command, shown whole. */
  argv?: readonly string[];
  /** The action button's word. */
  action: string;
  /** A word to type before the action button works (erase). */
  typed?: string;
}

/** What every screen and overlay can reach. */
export interface Ctx {
  readonly io: Io;
  readonly theme: Theme;
  readonly shell: Shell;
  readonly ws: Workspace;
  checks: CheapChecks;
  /** The commands this session ran, oldest first. */
  readonly ran: readonly Ran[];
  /** The last doctor run of this session. */
  lastDoctor: { code: number; at: string } | undefined;
  /** Whether tui.json was read or written this session (the status strip's "workspace saved"). */
  savedInUse: boolean;
  /** --no-saved: tui.json is neither read nor written. */
  readonly noSaved: boolean;
  /** The mouse is captured (help overlay's line). */
  readonly mouse: boolean;
  /** The terminal's size now. */
  readonly columns: number;
  readonly rows: number;

  push(screen: Screen): void;
  /** Back one screen; false at the bottom of the stack. */
  pop(): boolean;
  /** Replaces the whole stack with Home. */
  home(): void;
  /** Replaces the screen on top. */
  replace(screen: Screen): void;
  /** Opens a registry command's form, filled with `values` and `positionals`. */
  openCommand(spec: CommandSpec, values?: Values, positionals?: readonly string[]): void;
  /** Opens an overlay. */
  showOverlay(overlay: Overlay): void;
  /** Closes the overlay given, or the top one. */
  closeOverlay(overlay?: Overlay): void;
  /** Asks first; resolves to whether the person chose the action. */
  confirm(request: ConfirmRequest): Promise<boolean>;
  /**
   * Runs a command as `engram <argv>`, asking first when the registry entry
   * says it changes state; undefined when it was cancelled or is not run here.
   */
  act(spec: CommandSpec, argv: readonly string[], values: Values): Promise<RunResult | undefined>;
  /** Runs a command with no confirmation: the caller has asked (the first loop's steps). */
  runNow(argv: readonly string[]): Promise<RunResult>;
  /** Shows a line in the hints row until the next key. */
  say(message: string): void;
  /** Copies text by the terminal's path (./clipboard.ts) and says how. */
  copy(text: string): void;
  /** The command line of an argument vector, quoted for the shell: what `c` copies. */
  line(argv: readonly string[]): string;
  /** The command line as it is drawn: secrets redacted, control characters removed. */
  shown(argv: readonly string[]): string;
  /** Runs the cheap checks again. */
  recheck(log?: boolean): void;
  /** Writes tui.json from the workspace, unless --no-saved. */
  save(): void;
  /** Deletes tui.json. */
  forget(): boolean;
  /** Quits the TUI. */
  quit(): void;
  /** Asks for a redraw. */
  redraw(): void;
}
