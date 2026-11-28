// The key table (card E8.15b, docs/design/tui.md 9.1): every key the TUI
// binds, once, with the action it names, its hint and the screens it acts
// on. The router (./app.ts) matches keys through pi-tui's KeybindingsManager
// over this table; the help overlay, the footer hints and the key tests all
// read it. On each screen a key has one meaning. Every action has a binding
// with no function key, no Alt and neither ctrl+p nor F1 alone, which
// VS Code keeps for itself (they are only ever second bindings).
import { KeybindingsManager, type KeyId, matchesKey } from "@earendil-works/pi-tui";
import type { OverlayKind, ScreenKind } from "./screen.ts";

/** Where a binding acts: the screens and overlays it names. */
export type Where = ScreenKind | OverlayKind;

/** The screens that are not the too-small one: "everywhere" in the design's words. */
export const EVERYWHERE: readonly ScreenKind[] = [
  "home",
  "first-run",
  "loop",
  "workspace",
  "form",
  "result",
  "read",
  "explain",
  "item",
  "write",
  "promote",
  "grants",
  "events",
  "policy",
  "who",
  "supersede",
  "why-not",
  "surface",
];

/**
 * The memory and audit screens (card E8.15c, docs/design/tui.md 8.5 to 8.8,
 * 8.16 to 8.19, 8.22, 8.26): each mixes fields with a result, a list or both,
 * so tab moves between them and up and down move within a list.
 */
export const RICH: readonly ScreenKind[] = [
  "read",
  "explain",
  "item",
  "write",
  "promote",
  "grants",
  "events",
  "policy",
  "who",
  "supersede",
  "why-not",
];

/** The rich screens that show a command's result, with its plain and JSON views. */
const VIEWS: readonly ScreenKind[] = [...RICH.filter((k) => k !== "item"), "result"];

export interface KeyAction {
  /** The action's name, what a screen acts on. */
  action: string;
  keys: readonly KeyId[];
  /** How the hints and the help overlay write the keys. */
  label: string;
  description: string;
  where: readonly Where[];
}

const LIST: readonly ScreenKind[] = ["home", "result"];
const FIELDS: readonly ScreenKind[] = ["first-run", "workspace", "form", "surface"];
/** The screens with a form's choice, toggle and submit keys (card E8.15d adds its own). */
const FORMS: readonly ScreenKind[] = ["workspace", "form", "surface"];

/** The table, in the order the help overlay lists it. */
export const KEYS: readonly KeyAction[] = [
  // Everywhere.
  {
    action: "help",
    keys: ["?", "ctrl+g", "f1"],
    label: "? (ctrl+g in a field)",
    description: "this help",
    where: EVERYWHERE,
  },
  {
    action: "palette",
    // alt+p is the binding that works in a text field and that VS Code's terminal passes (review I9).
    keys: [";", "ctrl+p", "alt+p"],
    label: "; or alt+p (alt+p in a field)",
    description: "commands",
    where: EVERYWHERE,
  },
  {
    action: "workspace",
    keys: ["ctrl+o"],
    label: "ctrl+o",
    description: "workspace",
    where: EVERYWHERE,
  },
  { action: "back", keys: ["escape"], label: "esc", description: "back", where: EVERYWHERE },
  {
    action: "copy",
    keys: ["c", "alt+c"],
    label: "c (alt+c in a field)",
    description: "copy the command line",
    where: EVERYWHERE,
  },
  {
    action: "redraw",
    keys: ["ctrl+l"],
    label: "ctrl+l",
    description: "redraw the screen",
    where: [...EVERYWHERE, "too-small"],
  },
  {
    action: "quit-now",
    keys: ["ctrl+c"],
    label: "ctrl+c",
    description: "quit now",
    where: [...EVERYWHERE, "too-small", "help", "palette", "confirm"],
  },
  // Quitting and line mode.
  {
    action: "quit",
    keys: ["q"],
    label: "q",
    description: "quit",
    where: ["home", "first-run", "too-small"],
  },
  {
    action: "leave",
    keys: ["q"],
    label: "q",
    description: "back, outside a field",
    where: ["loop", "form", "result", "workspace", "surface", ...RICH],
  },
  {
    action: "line",
    keys: ["shift+l"],
    label: "L",
    description: "line mode, for screen readers",
    where: ["home", "first-run"],
  },
  // Lists.
  { action: "up", keys: ["up", "k"], label: "up k", description: "move up", where: LIST },
  { action: "down", keys: ["down", "j"], label: "down j", description: "move down", where: LIST },
  { action: "page-up", keys: ["pageUp"], label: "pgup", description: "page up", where: LIST },
  { action: "page-down", keys: ["pageDown"], label: "pgdn", description: "page down", where: LIST },
  { action: "first", keys: ["home"], label: "home", description: "first", where: LIST },
  { action: "last", keys: ["end"], label: "end", description: "last", where: LIST },
  // Home.
  { action: "open", keys: ["enter"], label: "enter", description: "open", where: ["home"] },
  ...[1, 2, 3, 4, 5, 6].map(
    (n): KeyAction => ({
      action: `group-${n}`,
      keys: [String(n) as KeyId],
      label: "1-6",
      description: "jump to a group",
      where: ["home"],
    }),
  ),
  // Fields.
  { action: "next", keys: ["tab"], label: "tab", description: "next field", where: FIELDS },
  {
    action: "prev",
    keys: ["shift+tab"],
    label: "shift+tab",
    description: "previous field",
    where: FIELDS,
  },
  {
    action: "field-up",
    keys: ["up"],
    label: "up",
    description: "the field or choice above",
    where: FIELDS,
  },
  {
    action: "field-down",
    keys: ["down"],
    label: "down",
    description: "the field or choice below",
    where: FIELDS,
  },
  { action: "accept", keys: ["enter"], label: "enter", description: "accept", where: FIELDS },
  {
    action: "toggle",
    keys: ["space"],
    label: "space",
    description: "toggle or choose, outside a text field",
    where: FORMS,
  },
  {
    action: "choose-prev",
    keys: ["left"],
    label: "left",
    description: "the previous choice, outside a text field",
    where: FORMS,
  },
  {
    action: "choose-next",
    keys: ["right"],
    label: "right",
    description: "the next choice, outside a text field",
    where: FORMS,
  },
  {
    action: "submit",
    keys: ["ctrl+s"],
    label: "ctrl+s",
    description: "run the form (it asks first where a change needs it)",
    where: FORMS,
  },
  { action: "doctor", keys: ["d"], label: "d", description: "run doctor", where: ["first-run"] },
  // The first loop.
  {
    action: "run-step",
    keys: ["enter"],
    label: "enter",
    description: "run this step",
    where: ["loop"],
  },
  {
    action: "skip",
    keys: ["s", "ctrl+n"],
    label: "s or ctrl+n",
    description: "skip this step (ctrl+n in a field)",
    where: ["loop"],
  },
  // The first loop: scrolling its steps' output, and a step's full result (review I10).
  { action: "up", keys: ["up"], label: "up", description: "scroll up", where: ["loop"] },
  { action: "down", keys: ["down"], label: "down", description: "scroll down", where: ["loop"] },
  { action: "page-up", keys: ["pageUp"], label: "pgup", description: "page up", where: ["loop"] },
  {
    action: "page-down",
    keys: ["pageDown"],
    label: "pgdn",
    description: "page down",
    where: ["loop"],
  },
  { action: "first", keys: ["home"], label: "home", description: "the top", where: ["loop"] },
  { action: "last", keys: ["end"], label: "end", description: "the end", where: ["loop"] },
  {
    action: "view",
    keys: ["v", "alt+v"],
    label: "v (alt+v in a field)",
    description: "the last step's full result",
    where: ["loop"],
  },
  // Results.
  {
    action: "rerun",
    keys: ["r"],
    label: "r",
    description: "run again with the same flags",
    where: [
      "result",
      "read",
      "explain",
      "events",
      "policy",
      "who",
      "item",
      "supersede",
      "why-not",
      "surface",
    ],
  },
  // The memory and audit screens (card E8.15c).
  { action: "next", keys: ["tab"], label: "tab", description: "next field or pane", where: RICH },
  {
    action: "prev",
    keys: ["shift+tab"],
    label: "shift+tab",
    description: "previous field or pane",
    where: RICH,
  },
  { action: "up", keys: ["up", "k"], label: "up k", description: "move up", where: RICH },
  { action: "down", keys: ["down", "j"], label: "down j", description: "move down", where: RICH },
  {
    action: "page-up",
    keys: ["pageUp"],
    label: "pgup",
    description: "page up",
    where: [...RICH, "surface"],
  },
  {
    action: "page-down",
    keys: ["pageDown"],
    label: "pgdn",
    description: "page down",
    where: [...RICH, "surface"],
  },
  {
    action: "first",
    keys: ["home"],
    label: "home",
    description: "first, outside a text field",
    where: RICH,
  },
  {
    action: "last",
    keys: ["end"],
    label: "end",
    description: "last, outside a text field",
    where: RICH,
  },
  {
    action: "accept",
    keys: ["enter"],
    label: "enter",
    description: "run, open or choose",
    where: RICH,
  },
  {
    action: "submit",
    keys: ["ctrl+s"],
    label: "ctrl+s",
    description: "run (it asks first where a change needs it)",
    where: RICH,
  },
  {
    action: "toggle",
    keys: ["space"],
    label: "space",
    description: "toggle or choose, outside a text field",
    where: RICH,
  },
  {
    action: "choose-prev",
    keys: ["left"],
    label: "left",
    description: "the previous choice, outside a text field",
    where: RICH,
  },
  {
    action: "choose-next",
    keys: ["right"],
    label: "right",
    description: "the next choice, outside a text field",
    where: RICH,
  },
  {
    action: "plain",
    keys: ["v", "alt+v"],
    label: "v (alt+v in a field)",
    description: "plain view: the command's exact text output",
    where: [...VIEWS, "surface"],
  },
  {
    action: "json",
    keys: ["shift+j", "alt+j"],
    label: "J (alt+j in a field)",
    description: "JSON view: the exact --json output",
    where: [...VIEWS, "surface"],
  },
  {
    action: "explain",
    keys: ["e"],
    label: "e",
    description: "explain the selected read",
    where: ["read", "events"],
  },
  {
    action: "item",
    keys: ["o"],
    label: "o",
    description: "the selected event's item page",
    where: ["events"],
  },
  {
    action: "promote",
    keys: ["p"],
    label: "p",
    description: "promote the selected item",
    where: ["read", "item", "events"],
  },
  {
    action: "grants",
    keys: ["g"],
    label: "g",
    description: "grants on the selected item",
    where: ["read", "item"],
  },
  {
    action: "who",
    keys: ["w"],
    label: "w",
    description: "who can read the selected item",
    where: ["read", "item"],
  },
  {
    action: "supersede",
    keys: ["shift+s"],
    label: "S",
    description: "supersede: the selected item's chain",
    where: ["read", "item"],
  },
  {
    // Card E2.17.
    action: "why-not",
    keys: ["n"],
    label: "n",
    description: "why not: the stage that keeps an item out of a read",
    where: ["read", "item"],
  },
  {
    action: "undo",
    keys: ["u"],
    label: "u",
    description: "undo the last grant change, as a new governed change",
    where: ["grants"],
  },
  {
    action: "follow",
    keys: ["f"],
    label: "f",
    description: "follow new events (a poll every 2 s while this screen is open)",
    where: ["events"],
  },
  {
    action: "find",
    keys: ["/"],
    label: "/",
    description: "find: events by reason, the policy by text",
    where: ["events", "policy"],
  },
  // Card E8.15d: the hand-made screens of lint, retention, simulate, doctor,
  // serve, MCP, the hook, export, import, keys and log verify. Each acts on
  // the ones it names (Screen.actions); none is a key a text field types.
  { action: "stop", keys: ["s"], label: "s", description: "stop the server", where: ["surface"] },
  {
    action: "open",
    keys: ["o"],
    label: "o",
    description: "copy the inspector's address",
    where: ["surface"],
  },
  { action: "keys", keys: ["k"], label: "k", description: "keys: create one", where: ["surface"] },
  { action: "new-key", keys: ["n"], label: "n", description: "a new key", where: ["surface"] },
  {
    action: "revoke",
    keys: ["shift+r"],
    label: "R",
    description: "revoke the selected key",
    where: ["surface"],
  },
  {
    action: "try",
    keys: ["t"],
    label: "t",
    description: "Try it on a scratch log",
    where: ["surface"],
  },
  { action: "all", keys: ["a"], label: "a", description: "all rows", where: ["surface"] },
  // Overlays.
  {
    action: "close",
    keys: ["escape"],
    label: "esc",
    description: "close",
    where: ["help", "palette"],
  },
  { action: "close-help", keys: ["?"], label: "?", description: "close", where: ["help"] },
  { action: "up", keys: ["up"], label: "up", description: "move up", where: ["help", "palette"] },
  {
    action: "down",
    keys: ["down"],
    label: "down",
    description: "move down",
    where: ["help", "palette"],
  },
  {
    action: "choose",
    keys: ["enter"],
    label: "enter",
    description: "open",
    where: ["palette", "confirm"],
  },
  {
    action: "fill",
    keys: ["tab"],
    label: "tab",
    description: "fill the line with the command",
    where: ["palette"],
  },
  { action: "yes", keys: ["y"], label: "y", description: "the action", where: ["confirm"] },
  {
    action: "no",
    keys: ["n", "escape"],
    label: "n esc",
    description: "cancel",
    where: ["confirm"],
  },
  {
    action: "switch",
    keys: ["tab", "shift+tab", "left", "right"],
    label: "tab",
    description: "the other button",
    where: ["confirm"],
  },
];

/** Whether a key id types a character in a text field (so it does not act there). */
export const printable = (key: string) =>
  key === "space" || [...key].length === 1 || /^shift\+.$/.test(key);

const bindingId = (i: number, a: KeyAction) => `engram.${i}.${a.action}` as never;

/** One KeybindingsManager per screen or overlay, over the actions that act there. */
const managers = new Map<Where, { manager: KeybindingsManager; actions: KeyAction[] }>();

function managerFor(where: Where) {
  let m = managers.get(where);
  if (m === undefined) {
    const actions = KEYS.filter((k) => k.where.includes(where));
    const definitions = Object.fromEntries(
      actions.map((a, i) => [
        bindingId(i, a),
        { defaultKeys: [...a.keys], description: a.description },
      ]),
    );
    m = { manager: new KeybindingsManager(definitions), actions };
    managers.set(where, m);
  }
  return m;
}

/** Actions that leave a text field its own keys: space types, left and right move the cursor. */
const INERT_IN_FIELD = new Set(["toggle", "choose-prev", "choose-next", "first", "last"]);

/**
 * The action a key names on a screen or overlay, if any. In a text field
 * only keys that type nothing act (esc, tab, enter, ctrl+ keys, up and
 * down): every printable key types, ":" included.
 */
export function actionFor(data: string, where: Where, inField: boolean): string | undefined {
  const { manager, actions } = managerFor(where);
  for (const [i, a] of actions.entries()) {
    if (!manager.matches(data, bindingId(i, a))) continue;
    const key = a.keys.find((k) => matchesKey(data, k));
    if (inField && (key === undefined || printable(key) || INERT_IN_FIELD.has(a.action))) continue;
    return a.action;
  }
  return undefined;
}

/** The actions acting on a screen or overlay, for the help overlay and the key tests. */
export const actionsOn = (where: Where): KeyAction[] => KEYS.filter((k) => k.where.includes(where));
