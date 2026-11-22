// The contract between the router (./app.ts) and its screens and overlays
// (card E8.15b). A screen draws its body, names its key hints and the
// command its command line row shows, and acts on the key table's actions
// (./app.ts KEYS); keys a text field types are handed to it raw. Types only,
// so the screens and the router import each other's shapes without a cycle.
import type { CommandSpec, Values } from "../registry.ts";
import type { Io } from "../run.ts";
import type { Shell } from "./argv.ts";
import type { RunResult } from "./runner.ts";
import type { SavedOptions } from "./saved.ts";
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
  | "too-small"
  // Card E8.15d: the hand-made screens of the policy, surface, machine and data commands.
  | "surface"
  // The memory and audit screens (card E8.15c).
  | "read"
  | "explain"
  | "item"
  | "write"
  | "promote"
  | "grants"
  | "events"
  | "policy"
  | "who"
  | "supersede";

/** The overlays, which take the keys while open. */
export type OverlayKind = "help" | "palette" | "confirm";

/** What the command line row shows. */
export interface CommandRow {
  /** The argument vector after `engram`: shown quoted for the shell. */
  argv?: readonly string[];
  /** Text shown instead, for a screen whose flags apply to every command. */
  text?: string;
  /** What `c` copies when `text` is drawn redacted: the whole of it. */
  copy?: string;
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
  /** The key table actions this screen acts on, when fewer than its kind's (the help overlay lists only these). */
  actions?(): readonly string[];
  /** Called once when the screen leaves the stack: a timer or a poll it runs stops (card E8.15c). */
  close?(): void;
  /**
   * Called once after the screen is pushed, queued behind the key that
   * opened it: a screen that shows a command's answer runs it here (Events,
   * Policy), asking first where the registry says so (card E8.15c).
   */
  opened?(ctx: Ctx): Promise<void>;
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
  /** A note printed after the exit code on quit: "stopped when the TUI quit" (card E8.15d). */
  note?: string;
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

/**
 * The reviewer handoff of docs/design/tui.md 8.8 (card E8.15c): Acting as
 * and Member of set for this session only, never saved; Switch back in the
 * workspace panel restores them.
 */
export interface Handoff {
  /** The reviewer's principal, now Acting as. */
  reviewer: string;
  /** The promotion's target scope. */
  target: string;
  /** The reviewer's memberships for this session, now Member of. */
  members: readonly string[];
  /** The actor before the switch, as the title bar wrote it. */
  before: string;
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
  /**
   * What each of them returned, oldest first: the item pickers, the grants
   * list and the item page read the session's last read here (card E8.15c).
   */
  readonly results: readonly RunResult[];
  /** The reviewer handoff, while one is on. */
  readonly handoff: Handoff | undefined;
  /** Switches to a reviewer for this session: Acting as and Member of (8.8). */
  startHandoff(reviewer: string, members: readonly string[], target?: string): void;
  /** Switch back: the actor and memberships before the handoff; false when none was on. */
  endHandoff(): boolean;
  /** The last doctor run of this session. */
  lastDoctor: { code: number; at: string } | undefined;
  /** Whether tui.json was read or written this session (the status strip's "workspace saved"). */
  savedInUse: boolean;
  /** The TUI's options tui.json holds: what the workspace panel's toggles save. */
  savedOptions: SavedOptions;
  /** In server mode, GET /health: whether the server answered; undefined in process. */
  checkServer(): Promise<boolean | undefined>;
  /** --no-saved: tui.json is neither read nor written. */
  readonly noSaved: boolean;
  /** The mouse is captured (help overlay's line). */
  readonly mouse: boolean;
  /** The terminal's size now. */
  readonly columns: number;
  readonly rows: number;

  push(screen: Screen): void;
  /** The screen on top, the one drawn (a covered screen does not poll, card E8.15c review). */
  top(): Screen;
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
  act(
    spec: CommandSpec,
    argv: readonly string[],
    values: Values,
    /** More lines for the confirmation, such as a write's preview (card E8.15c). */
    extra?: readonly string[],
  ): Promise<RunResult | undefined>;
  /** Runs a command with no confirmation: the caller has asked (the first loop's steps). */
  runNow(argv: readonly string[]): Promise<RunResult>;
  /** Records a command run outside runNow (a server the Serve screen ran until stopped, card E8.15d). */
  record(ran: Ran): void;
  /**
   * Registers what quitting must stop first (a running server, a Try it
   * child, card E8.15d); returns the function that unregisters it.
   */
  onQuit(stop: () => Promise<void>): () => void;
  /**
   * A command that only looks (a write's check preview, the events screen's
   * follow poll): never asked, not in the session's summary, and drawing
   * no id from the session's ids (card E8.15c).
   */
  peek(argv: readonly string[]): Promise<RunResult>;
  /** Shows a line in the hints row until the next key. */
  say(message: string): void;
  /** Copies the command row of the screen underneath, whole. */
  copyCommand(): void;
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
